using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.Orders;

public class OrdersTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _authClient;  // staff (authenticated)
    private readonly HttpClient _anonClient;  // customer (no auth)
    private readonly TestWebAppFactory _factory;
    private Guid _qrToken;
    private Guid _tableId;
    private Guid _categoryId;
    private Guid _menuItemId;
    private decimal _menuItemPrice;

    public OrdersTests(TestWebAppFactory factory)
    {
        _factory = factory;

        _authClient = factory.CreateClient();
        _authClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        _anonClient = factory.CreateClient();
        _anonClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        SetupAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAsync()
    {
        // Authenticate staff
        var email = $"orders_{Guid.NewGuid():N}@test.com";
        await _authClient.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Order Tester" });
        var loginResp = await _authClient.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        _authClient.DefaultRequestHeaders.Authorization =
            new("Bearer", loginBody.GetProperty("accessToken").GetString()!);

        // Create space → table → capture QR token
        var spaceResp = await _authClient.PostAsJsonAsync("/spaces",
            new { name = "Order Space", cols = 5, rows = 5, sortOrder = 0 });
        var spaceBody = await spaceResp.Content.ReadFromJsonAsync<JsonElement>();
        var spaceId = spaceBody.GetProperty("id").GetString()!;

        var tableResp = await _authClient.PostAsJsonAsync("/tables",
            new { spaceId, number = "T1", col = 1, row = 1 });
        var tableBody = await tableResp.Content.ReadFromJsonAsync<JsonElement>();
        _tableId  = Guid.Parse(tableBody.GetProperty("id").GetString()!);
        _qrToken  = Guid.Parse(tableBody.GetProperty("qrToken").GetString()!);

        // Create category → menu item
        var catResp = await _authClient.PostAsJsonAsync("/categories",
            new { name = "Order Cat", sortOrder = 0 });
        var catBody = await catResp.Content.ReadFromJsonAsync<JsonElement>();
        _categoryId = Guid.Parse(catBody.GetProperty("id").GetString()!);

        _menuItemPrice = 8.500m;
        var itemResp = await _authClient.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name = "Burger", price = _menuItemPrice, sortOrder = 0 });
        var itemBody = await itemResp.Content.ReadFromJsonAsync<JsonElement>();
        _menuItemId = Guid.Parse(itemBody.GetProperty("id").GetString()!);
    }

    private async Task<(HttpResponseMessage Resp, JsonElement Body)> PlaceOrderAsync(
        int quantity = 2, string? notes = null)
    {
        var payload = new
        {
            qrToken = _qrToken,
            items = new[] { new { menuItemId = _menuItemId, quantity, notes } },
            notes,
        };
        var resp = await _anonClient.PostAsJsonAsync("/orders", payload);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return (resp, body);
    }

    // ── Create (public) ───────────────────────────────────────────────────────

    [Fact]
    public async Task PlaceOrder_ValidQrToken_Returns201()
    {
        var (resp, body) = await PlaceOrderAsync(quantity: 1);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("status").GetString().Should().Be("Pending");
        body.GetProperty("tableNumber").GetString().Should().Be("T1");
    }

    [Fact]
    public async Task PlaceOrder_PriceSnapshotted_MatchesMenuItemPrice()
    {
        var (_, body) = await PlaceOrderAsync(quantity: 3);

        var item = body.GetProperty("items").EnumerateArray().First();
        item.GetProperty("unitPrice").GetDecimal().Should().Be(_menuItemPrice);
        body.GetProperty("total").GetDecimal().Should().Be(_menuItemPrice * 3);
    }

    [Fact]
    public async Task PlaceOrder_InvalidQrToken_Returns404()
    {
        var resp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = Guid.NewGuid(),
            items = new[] { new { menuItemId = _menuItemId, quantity = 1 } },
        });

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task PlaceOrder_EmptyItems_Returns400()
    {
        var resp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = Array.Empty<object>(),
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PlaceOrder_UnavailableItem_Returns400()
    {
        // Mark item unavailable
        await _authClient.PutAsJsonAsync($"/menu-items/{_menuItemId}", new
        {
            categoryId  = _categoryId,
            name        = "Burger",
            price       = _menuItemPrice,
            isAvailable = false,
            sortOrder   = 0,
        });

        var resp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 1 } },
        });

        // Restore item for other tests
        await _authClient.PutAsJsonAsync($"/menu-items/{_menuItemId}", new
        {
            categoryId  = _categoryId,
            name        = "Burger",
            price       = _menuItemPrice,
            isAvailable = true,
            sortOrder   = 0,
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PlaceOrder_NoAuthRequired_Returns201()
    {
        // Completely unauthenticated client (no token at all)
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        var resp = await client.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 1 } },
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListOrders_Returns200WithPlacedOrder()
    {
        var (_, created) = await PlaceOrderAsync();
        var orderId = created.GetProperty("id").GetString()!;

        var resp = await _authClient.GetAsync("/orders");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var ids = body.EnumerateArray().Select(o => o.GetProperty("id").GetString()).ToList();
        ids.Should().Contain(orderId);
    }

    [Fact]
    public async Task ListOrders_FilterByStatus_ReturnsOnlyMatchingOrders()
    {
        await PlaceOrderAsync();

        var resp = await _authClient.GetAsync("/orders?status=Pending");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.EnumerateArray().Should().OnlyContain(o =>
            o.GetProperty("status").GetString() == "Pending");
    }

    [Fact]
    public async Task ListOrders_InvalidStatusFilter_Returns400()
    {
        var resp = await _authClient.GetAsync("/orders?status=Blah");

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ListOrders_NoToken_Returns401()
    {
        var resp = await _anonClient.GetAsync("/orders");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Get single ────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetOrder_ExistingId_Returns200WithItems()
    {
        var (_, created) = await PlaceOrderAsync(quantity: 2);
        var id = created.GetProperty("id").GetString()!;

        var resp = await _authClient.GetAsync($"/orders/{id}");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("items").GetArrayLength().Should().Be(1);
        body.GetProperty("items").EnumerateArray().First()
            .GetProperty("quantity").GetInt32().Should().Be(2);
    }

    [Fact]
    public async Task GetOrder_UnknownId_Returns404()
    {
        var resp = await _authClient.GetAsync($"/orders/{Guid.NewGuid()}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Status transitions ────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateStatus_PendingToInProgress_Returns200()
    {
        var (_, created) = await PlaceOrderAsync();
        var id = created.GetProperty("id").GetString()!;

        var resp = await _authClient.PutAsJsonAsync($"/orders/{id}/status",
            new { status = "InProgress" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("status").GetString().Should().Be("InProgress");
    }

    [Fact]
    public async Task UpdateStatus_AllTransitions_WorkCorrectly()
    {
        var (_, created) = await PlaceOrderAsync();
        var id = created.GetProperty("id").GetString()!;

        foreach (var status in new[] { "InProgress", "Ready", "Completed" })
        {
            var resp = await _authClient.PutAsJsonAsync($"/orders/{id}/status",
                new { status });
            resp.StatusCode.Should().Be(HttpStatusCode.OK);
            var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
            body.GetProperty("status").GetString().Should().Be(status);
        }
    }

    [Fact]
    public async Task UpdateStatus_InvalidStatus_Returns400()
    {
        var (_, created) = await PlaceOrderAsync();
        var id = created.GetProperty("id").GetString()!;

        var resp = await _authClient.PutAsJsonAsync($"/orders/{id}/status",
            new { status = "Flying" });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateStatus_NoToken_Returns401()
    {
        var (_, created) = await PlaceOrderAsync();
        var id = created.GetProperty("id").GetString()!;

        var resp = await _anonClient.PutAsJsonAsync($"/orders/{id}/status",
            new { status = "InProgress" });

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CancelOrder_PendingOrder_Returns204AndStatusIsCancelled()
    {
        var (_, created) = await PlaceOrderAsync();
        var id = created.GetProperty("id").GetString()!;

        var deleteResp = await _authClient.DeleteAsync($"/orders/{id}");
        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResp = await _authClient.GetAsync($"/orders/{id}");
        var body = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("status").GetString().Should().Be("Cancelled");
    }

    [Fact]
    public async Task CancelOrder_CompletedOrder_Returns409()
    {
        var (_, created) = await PlaceOrderAsync();
        var id = created.GetProperty("id").GetString()!;

        await _authClient.PutAsJsonAsync($"/orders/{id}/status", new { status = "Completed" });

        var resp = await _authClient.DeleteAsync($"/orders/{id}");

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CancelOrder_NoToken_Returns401()
    {
        var (_, created) = await PlaceOrderAsync();
        var id = created.GetProperty("id").GetString()!;

        var resp = await _anonClient.DeleteAsync($"/orders/{id}");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
