using FluentAssertions;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace TabHub.Tests.Integration.TenantIsolation;

/// <summary>
/// Verifies that orders placed in one tenant are never visible to another tenant.
/// </summary>
public class OrderTenantIsolationTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;
    private string _cafeToken   = null!;
    private string _restoToken  = null!;
    private Guid   _cafeQrToken;
    private Guid   _restoQrToken;
    private Guid   _cafeItemId;
    private Guid   _restoItemId;

    public OrderTenantIsolationTests(TestWebAppFactory factory)
    {
        _factory = factory;
        SetupAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAsync()
    {
        _cafeToken  = await RegisterAndLoginAsync("cafetunisia");
        _restoToken = await RegisterAndLoginAsync("restauranttunisia");

        (_cafeQrToken,  _cafeItemId)  = await SetupTenantAsync("cafetunisia",  _cafeToken,  "Cafe");
        (_restoQrToken, _restoItemId) = await SetupTenantAsync("restauranttunisia", _restoToken, "Resto");
    }

    private async Task<string> RegisterAndLoginAsync(string tenant)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", tenant);
        var email = $"orderiso_{tenant}_{Guid.NewGuid():N}@test.com";
        await client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = $"{tenant} isolation" });
        var resp = await client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("accessToken").GetString()!;
    }

    private async Task<(Guid QrToken, Guid ItemId)> SetupTenantAsync(
        string tenant, string token, string prefix)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", tenant);
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var spaceResp = await client.PostAsJsonAsync("/spaces",
            new { name = $"{prefix} Space", cols = 3, rows = 3, sortOrder = 0 });
        var spaceBody = await spaceResp.Content.ReadFromJsonAsync<JsonElement>();
        var spaceId   = spaceBody.GetProperty("id").GetString()!;

        var tableResp = await client.PostAsJsonAsync("/tables",
            new { spaceId, number = $"{prefix}T1", col = 1, row = 1 });
        var tableBody = await tableResp.Content.ReadFromJsonAsync<JsonElement>();
        var qrToken   = Guid.Parse(tableBody.GetProperty("qrToken").GetString()!);

        var catResp = await client.PostAsJsonAsync("/categories",
            new { name = $"{prefix} Cat", sortOrder = 0 });
        var catBody = await catResp.Content.ReadFromJsonAsync<JsonElement>();
        var catId   = catBody.GetProperty("id").GetString()!;

        var itemResp = await client.PostAsJsonAsync("/menu-items",
            new { categoryId = catId, name = $"{prefix} Item", price = 5.0m, sortOrder = 0 });
        var itemBody = await itemResp.Content.ReadFromJsonAsync<JsonElement>();
        var itemId   = Guid.Parse(itemBody.GetProperty("id").GetString()!);

        return (qrToken, itemId);
    }

    private HttpClient AuthClient(string tenant, string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", tenant);
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        return client;
    }

    private async Task<string> PlaceOrderAsync(string tenant, Guid qrToken, Guid itemId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", tenant);
        var resp = await client.PostAsJsonAsync("/orders", new
        {
            qrToken,
            items = new[] { new { menuItemId = itemId, quantity = 1 } },
        });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetString()!;
    }

    // ── Order list isolation ──────────────────────────────────────────────────

    [Fact]
    public async Task Order_PlacedInCafe_NotVisibleInRestaurant()
    {
        var cafeOrderId = await PlaceOrderAsync("cafetunisia", _cafeQrToken, _cafeItemId);

        var restoClient = AuthClient("restauranttunisia", _restoToken);
        var resp = await restoClient.GetAsync("/orders");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = body.EnumerateArray().Select(o => o.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(cafeOrderId,
            "an order placed in cafetunisia must not appear in restauranttunisia");
    }

    [Fact]
    public async Task Order_PlacedInRestaurant_NotVisibleInCafe()
    {
        var restoOrderId = await PlaceOrderAsync("restauranttunisia", _restoQrToken, _restoItemId);

        var cafeClient = AuthClient("cafetunisia", _cafeToken);
        var resp = await cafeClient.GetAsync("/orders");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = body.EnumerateArray().Select(o => o.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(restoOrderId,
            "an order placed in restauranttunisia must not appear in cafetunisia");
    }

    // ── Cross-tenant GET by ID ────────────────────────────────────────────────

    [Fact]
    public async Task Order_GetByIdFromOtherTenant_Returns404()
    {
        var cafeOrderId = await PlaceOrderAsync("cafetunisia", _cafeQrToken, _cafeItemId);

        var restoClient = AuthClient("restauranttunisia", _restoToken);
        var resp = await restoClient.GetAsync($"/orders/{cafeOrderId}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "an order from another tenant must not be accessible via GET by ID");
    }

    // ── Cross-tenant status update ────────────────────────────────────────────

    [Fact]
    public async Task Order_StatusUpdateFromOtherTenant_Returns404()
    {
        var cafeOrderId = await PlaceOrderAsync("cafetunisia", _cafeQrToken, _cafeItemId);

        var restoClient = AuthClient("restauranttunisia", _restoToken);
        var resp = await restoClient.PutAsJsonAsync($"/orders/{cafeOrderId}/status",
            new { status = "InProgress" });

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "a cross-tenant status update must be blocked");
    }

    // ── QR token isolation ────────────────────────────────────────────────────

    [Fact]
    public async Task Order_CafetunisiaQrToken_CannotPlaceOrderForRestaurant()
    {
        // Try to use cafetunisia's QR token to place an order on restauranttunisia
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", "restauranttunisia");

        var resp = await client.PostAsJsonAsync("/orders", new
        {
            qrToken = _cafeQrToken,   // belongs to cafetunisia, not restauranttunisia
            items   = new[] { new { menuItemId = _restoItemId, quantity = 1 } },
        });

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "a QR token from another tenant's table must not work in a different tenant context");
    }
}
