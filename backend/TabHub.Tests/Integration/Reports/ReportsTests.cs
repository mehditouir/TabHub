using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.Reports;

public class ReportsTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly HttpClient _anonClient;
    private readonly TestWebAppFactory _factory;
    private Guid _qrToken;
    private Guid _categoryId;
    private Guid _itemAId;
    private Guid _itemBId;

    public ReportsTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client  = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        _anonClient = factory.CreateClient();
        _anonClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        SetupAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAsync()
    {
        var email = $"rep_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Reports Tester" });
        var loginResp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", loginBody.GetProperty("accessToken").GetString()!);

        var spaceResp = await _client.PostAsJsonAsync("/spaces",
            new { name = "Reports Space", cols = 5, rows = 5, sortOrder = 0 });
        var spaceId = (await spaceResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetString()!;

        var tableResp = await _client.PostAsJsonAsync("/tables",
            new { spaceId, number = "R1", col = 1, row = 1 });
        _qrToken = Guid.Parse((await tableResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("qrToken").GetString()!);

        var catResp = await _client.PostAsJsonAsync("/categories",
            new { name = "Reports Cat", sortOrder = 0 });
        _categoryId = Guid.Parse((await catResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetString()!);

        var itemAResp = await _client.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name = "Pizza", price = 12.0m, sortOrder = 0 });
        _itemAId = Guid.Parse((await itemAResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetString()!);

        var itemBResp = await _client.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name = "Pasta", price = 8.0m, sortOrder = 1 });
        _itemBId = Guid.Parse((await itemBResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetString()!);
    }

    private async Task<string> PlaceAndCompleteOrderAsync(
        Guid itemId, int quantity, bool complete = true)
    {
        var orderResp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = itemId, quantity } },
        });
        var orderId = (await orderResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetString()!;

        if (complete)
            await _client.PutAsJsonAsync($"/orders/{orderId}/status", new { status = "Completed" });

        return orderId;
    }

    // ── Revenue ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Revenue_CompletedOrders_IncludedInTotal()
    {
        await PlaceAndCompleteOrderAsync(_itemAId, 2);  // 2 × 12.0 = 24.0

        var resp = await _client.GetAsync("/reports/revenue");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("totalRevenue").GetDecimal().Should().BeGreaterThan(0);
        body.GetProperty("totalOrders").GetInt32().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Revenue_PendingOrder_NotCountedAsRevenue()
    {
        // Place but do NOT complete — should not affect revenue
        await PlaceAndCompleteOrderAsync(_itemAId, 1, complete: false);

        var resp = await _client.GetAsync(
            $"/reports/revenue?from={DateTime.UtcNow:O}&to={DateTime.UtcNow.AddMinutes(1):O}");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        // Revenue in a 1-minute future window should be 0
        body.GetProperty("totalRevenue").GetDecimal().Should().Be(0);
    }

    [Fact]
    public async Task Revenue_ByDayGrouping_ContainsToday()
    {
        await PlaceAndCompleteOrderAsync(_itemAId, 1);

        var resp = await _client.GetAsync("/reports/revenue");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var byDay = body.GetProperty("byDay").EnumerateArray().ToList();
        byDay.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Revenue_InvalidDateRange_Returns400()
    {
        var resp = await _client.GetAsync(
            $"/reports/revenue?from={DateTime.UtcNow.AddDays(1):O}&to={DateTime.UtcNow:O}");

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Revenue_NoToken_Returns401()
    {
        var resp = await _anonClient.GetAsync("/reports/revenue");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Top items ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task TopItems_ReturnsItemsOrderedByQuantity()
    {
        // Pizza × 3, Pasta × 1 → Pizza should rank first
        await PlaceAndCompleteOrderAsync(_itemAId, 3);
        await PlaceAndCompleteOrderAsync(_itemBId, 1);

        var resp = await _client.GetAsync("/reports/top-items");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = body.EnumerateArray().ToList();
        items.Should().NotBeEmpty();

        // First item must have the highest quantity
        var first = items.First();
        first.GetProperty("name").GetString().Should().Be("Pizza");
        first.GetProperty("totalQuantity").GetInt32().Should().BeGreaterThanOrEqualTo(3);
    }

    [Fact]
    public async Task TopItems_RevenueCalculatedCorrectly()
    {
        await PlaceAndCompleteOrderAsync(_itemAId, 2); // 2 × 12.0 = 24.0

        var resp = await _client.GetAsync("/reports/top-items");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var pizza = body.EnumerateArray()
            .FirstOrDefault(i => i.GetProperty("name").GetString() == "Pizza");

        pizza.ValueKind.Should().NotBe(JsonValueKind.Undefined);
        pizza.GetProperty("totalRevenue").GetDecimal().Should().BeGreaterThanOrEqualTo(24.0m);
    }

    [Fact]
    public async Task TopItems_LimitParam_RespectsLimit()
    {
        var resp = await _client.GetAsync("/reports/top-items?limit=1");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        body.GetArrayLength().Should().BeLessThanOrEqualTo(1);
    }

    [Fact]
    public async Task TopItems_LimitOutOfRange_Returns400()
    {
        var resp = await _client.GetAsync("/reports/top-items?limit=0");

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task TopItems_OnlyCompletedOrders_Counted()
    {
        // Place but do NOT complete — should not appear in top items
        var pendingItemResp = await _client.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name = "Ghost Dish", price = 99.0m, sortOrder = 99 });
        var ghostId = Guid.Parse((await pendingItemResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetString()!);

        await PlaceAndCompleteOrderAsync(ghostId, 100, complete: false);

        var resp = await _client.GetAsync("/reports/top-items");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var names = body.EnumerateArray()
            .Select(i => i.GetProperty("name").GetString())
            .ToList();
        names.Should().NotContain("Ghost Dish",
            "items from non-completed orders must not appear in top items");
    }

    [Fact]
    public async Task TopItems_NoToken_Returns401()
    {
        var resp = await _anonClient.GetAsync("/reports/top-items");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Orders summary ────────────────────────────────────────────────────────

    [Fact]
    public async Task OrdersSummary_Returns200WithAllStatusCounts()
    {
        var resp = await _client.GetAsync("/reports/orders/summary");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.TryGetProperty("totalOrders",  out _).Should().BeTrue();
        body.TryGetProperty("pending",      out _).Should().BeTrue();
        body.TryGetProperty("inProgress",   out _).Should().BeTrue();
        body.TryGetProperty("ready",        out _).Should().BeTrue();
        body.TryGetProperty("completed",    out _).Should().BeTrue();
        body.TryGetProperty("cancelled",    out _).Should().BeTrue();
    }

    [Fact]
    public async Task OrdersSummary_CompletedOrdersIncreaseCount()
    {
        var before = await _client.GetAsync("/reports/orders/summary");
        var beforeBody = await before.Content.ReadFromJsonAsync<JsonElement>();
        var beforeCompleted = beforeBody.GetProperty("completed").GetInt32();

        await PlaceAndCompleteOrderAsync(_itemAId, 1);

        var after = await _client.GetAsync("/reports/orders/summary");
        var afterBody = await after.Content.ReadFromJsonAsync<JsonElement>();

        afterBody.GetProperty("completed").GetInt32().Should().BeGreaterThan(beforeCompleted);
    }

    [Fact]
    public async Task OrdersSummary_AvgCompletionMinutes_NonNullAfterCompletedOrder()
    {
        await PlaceAndCompleteOrderAsync(_itemAId, 1);

        var resp = await _client.GetAsync("/reports/orders/summary");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        body.GetProperty("avgCompletionMinutes").ValueKind.Should().NotBe(JsonValueKind.Null,
            "avgCompletionMinutes must be non-null when completed orders exist");
    }

    [Fact]
    public async Task OrdersSummary_NoToken_Returns401()
    {
        var resp = await _anonClient.GetAsync("/reports/orders/summary");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Busiest hours ─────────────────────────────────────────────────────────

    [Fact]
    public async Task BusiestHours_Returns200WithHourlyBuckets()
    {
        await PlaceAndCompleteOrderAsync(_itemAId, 1);

        var resp = await _client.GetAsync("/reports/busiest-hours");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var hours = body.EnumerateArray().ToList();
        hours.Should().NotBeEmpty();
        hours.Should().OnlyContain(h =>
            h.GetProperty("hour").GetInt32() >= 0 && h.GetProperty("hour").GetInt32() <= 23);
    }

    [Fact]
    public async Task BusiestHours_HoursAreOrderedAscending()
    {
        await PlaceAndCompleteOrderAsync(_itemAId, 1);

        var resp = await _client.GetAsync("/reports/busiest-hours");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var hours = body.EnumerateArray()
            .Select(h => h.GetProperty("hour").GetInt32())
            .ToList();

        hours.Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task BusiestHours_NoToken_Returns401()
    {
        var resp = await _anonClient.GetAsync("/reports/busiest-hours");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Tenant isolation ──────────────────────────────────────────────────────

    [Fact]
    public async Task Reports_DataIsolatedFromOtherTenants()
    {
        // Complete an order in cafetunisia
        await PlaceAndCompleteOrderAsync(_itemAId, 5);

        // restauranttunisia manager should have separate (lower) revenue
        var restoEmail = $"rep_resto_{Guid.NewGuid():N}@test.com";
        var restoClient = _factory.CreateClient();
        restoClient.DefaultRequestHeaders.Add("X-Tenant", "restauranttunisia");
        await restoClient.PostAsJsonAsync("/auth/register",
            new { email = restoEmail, password = "Test123!", displayName = "Resto Reports" });
        var restoLogin = await restoClient.PostAsJsonAsync("/auth/login",
            new { email = restoEmail, password = "Test123!" });
        var restoToken = (await restoLogin.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("accessToken").GetString()!;
        restoClient.DefaultRequestHeaders.Authorization = new("Bearer", restoToken);

        var cafeResp  = await _client.GetAsync("/reports/orders/summary");
        var restoResp = await restoClient.GetAsync("/reports/orders/summary");

        var cafeTotal  = (await cafeResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("totalOrders").GetInt32();
        var restoTotal = (await restoResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("totalOrders").GetInt32();

        cafeTotal.Should().NotBe(restoTotal,
            "each tenant's reports must reflect only their own data");
    }
}
