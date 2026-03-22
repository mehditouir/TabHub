using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace TabHub.Tests.Integration.Orders;

/// <summary>
/// Tests for order integrity: price snapshot, audit logs, and business rules.
/// </summary>
public class OrderIntegrityTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _authClient;
    private readonly HttpClient _anonClient;
    private readonly TestWebAppFactory _factory;
    private Guid _qrToken;
    private Guid _categoryId;
    private Guid _menuItemId;
    private decimal _originalPrice;

    public OrderIntegrityTests(TestWebAppFactory factory)
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
        var email = $"ordint_{Guid.NewGuid():N}@test.com";
        await _authClient.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Order Integrity" });
        var loginResp = await _authClient.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        _authClient.DefaultRequestHeaders.Authorization =
            new("Bearer", loginBody.GetProperty("accessToken").GetString()!);

        var spaceResp = await _authClient.PostAsJsonAsync("/spaces",
            new { name = "Integrity Space", cols = 3, rows = 3, sortOrder = 0 });
        var spaceBody = await spaceResp.Content.ReadFromJsonAsync<JsonElement>();
        var spaceId = spaceBody.GetProperty("id").GetString()!;

        var tableResp = await _authClient.PostAsJsonAsync("/tables",
            new { spaceId, number = "TI1", col = 1, row = 1 });
        var tableBody = await tableResp.Content.ReadFromJsonAsync<JsonElement>();
        _qrToken = Guid.Parse(tableBody.GetProperty("qrToken").GetString()!);

        var catResp = await _authClient.PostAsJsonAsync("/categories",
            new { name = "Integrity Cat", sortOrder = 0 });
        var catBody = await catResp.Content.ReadFromJsonAsync<JsonElement>();
        _categoryId = Guid.Parse(catBody.GetProperty("id").GetString()!);

        _originalPrice = 12.500m;
        var itemResp = await _authClient.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name = "Steak", price = _originalPrice, sortOrder = 0 });
        var itemBody = await itemResp.Content.ReadFromJsonAsync<JsonElement>();
        _menuItemId = Guid.Parse(itemBody.GetProperty("id").GetString()!);
    }

    // ── Price snapshot ────────────────────────────────────────────────────────

    [Fact]
    public async Task PriceSnapshot_ChangingMenuItemPrice_DoesNotAffectExistingOrder()
    {
        // Place an order at original price
        var orderResp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 2 } },
        });
        var orderBody = await orderResp.Content.ReadFromJsonAsync<JsonElement>();
        var orderId = orderBody.GetProperty("id").GetString()!;

        // Change the menu item price
        var newPrice = 20.000m;
        await _authClient.PutAsJsonAsync($"/menu-items/{_menuItemId}", new
        {
            categoryId  = _categoryId,
            name        = "Steak",
            price       = newPrice,
            isAvailable = true,
            sortOrder   = 0,
        });

        // Verify the existing order still uses the original price
        var getResp = await _authClient.GetAsync($"/orders/{orderId}");
        var body = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        var item = body.GetProperty("items").EnumerateArray().First();

        item.GetProperty("unitPrice").GetDecimal().Should().Be(_originalPrice,
            "the price must be snapshotted at order creation time");
        body.GetProperty("total").GetDecimal().Should().Be(_originalPrice * 2);
    }

    [Fact]
    public async Task PriceSnapshot_StoredInOrderItemRow()
    {
        var orderResp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 1 } },
        });
        var orderBody = await orderResp.Content.ReadFromJsonAsync<JsonElement>();
        var orderId   = Guid.Parse(orderBody.GetProperty("id").GetString()!);

        var dbItem = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.OrderItems.FirstOrDefaultAsync(i => i.OrderId == orderId));

        dbItem.Should().NotBeNull();
        dbItem!.UnitPrice.Should().Be(_originalPrice);
        dbItem.MenuItemName.Should().Be("Steak");
    }

    // ── Audit logs ────────────────────────────────────────────────────────────

    [Fact]
    public async Task PlaceOrder_AuditLogIsWritten()
    {
        var orderResp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 1 } },
        });
        var orderBody = await orderResp.Content.ReadFromJsonAsync<JsonElement>();
        var orderId   = orderBody.GetProperty("id").GetString()!;

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Order" && a.EntityId == orderId && a.Action == "create"));

        log.Should().NotBeNull("a create audit log must be written for each order");
        log!.AfterState.Should().NotBeNull();
    }

    [Fact]
    public async Task StatusUpdate_AuditLogIsWritten()
    {
        var orderResp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 1 } },
        });
        var orderBody = await orderResp.Content.ReadFromJsonAsync<JsonElement>();
        var orderId   = orderBody.GetProperty("id").GetString()!;

        await _authClient.PutAsJsonAsync($"/orders/{orderId}/status", new { status = "InProgress" });

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Order" && a.EntityId == orderId && a.Action == "status_update"));

        log.Should().NotBeNull("a status_update audit log must be written");
        log!.BeforeState.Should().NotBeNull();
        log.AfterState.Should().NotBeNull();
    }

    [Fact]
    public async Task CancelOrder_AuditLogIsWritten()
    {
        var orderResp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 1 } },
        });
        var orderBody = await orderResp.Content.ReadFromJsonAsync<JsonElement>();
        var orderId   = orderBody.GetProperty("id").GetString()!;

        await _authClient.DeleteAsync($"/orders/{orderId}");

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Order" && a.EntityId == orderId && a.Action == "cancel"));

        log.Should().NotBeNull("a cancel audit log must be written");
        log!.BeforeState.Should().NotBeNull();
    }

    // ── Order items cascade ───────────────────────────────────────────────────

    [Fact]
    public async Task PlaceOrder_MultipleItems_AllStoredCorrectly()
    {
        // Add a second menu item
        var item2Resp = await _authClient.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name = "Fries", price = 3.000m, sortOrder = 1 });
        var item2Body = await item2Resp.Content.ReadFromJsonAsync<JsonElement>();
        var item2Id   = Guid.Parse(item2Body.GetProperty("id").GetString()!);

        var orderResp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items = new object[]
            {
                new { menuItemId = _menuItemId, quantity = 1 },
                new { menuItemId = item2Id,     quantity = 2, notes = "Extra crispy" },
            },
        });
        var orderBody = await orderResp.Content.ReadFromJsonAsync<JsonElement>();
        var orderId   = Guid.Parse(orderBody.GetProperty("id").GetString()!);

        var dbItems = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.OrderItems.Where(i => i.OrderId == orderId).ToListAsync());

        dbItems.Should().HaveCount(2);
        dbItems.Should().Contain(i => i.MenuItemName == "Steak" && i.Quantity == 1);
        dbItems.Should().Contain(i => i.MenuItemName == "Fries" && i.Quantity == 2 && i.Notes == "Extra crispy");

        // Total = 12.500 + (3.000 * 2) = 18.500
        orderBody.GetProperty("total").GetDecimal().Should().Be(18.500m);
    }

    // ── Business rules ────────────────────────────────────────────────────────

    [Fact]
    public async Task PlaceOrder_DeletedMenuItem_Returns400()
    {
        // Create a throwaway item and delete it
        var itemResp = await _authClient.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name = "Deleted Item", price = 5.0m, sortOrder = 99 });
        var itemBody = await itemResp.Content.ReadFromJsonAsync<JsonElement>();
        var itemId   = Guid.Parse(itemBody.GetProperty("id").GetString()!);
        await _authClient.DeleteAsync($"/menu-items/{itemId}");

        var resp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = itemId, quantity = 1 } },
        });

        resp.StatusCode.Should().Be(System.Net.HttpStatusCode.BadRequest,
            "ordering a deleted item must be rejected");
    }
}
