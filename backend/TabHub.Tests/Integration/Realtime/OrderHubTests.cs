using FluentAssertions;
using Microsoft.AspNetCore.SignalR.Client;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace TabHub.Tests.Integration.Realtime;

/// <summary>
/// Integration tests for the SignalR OrderHub.
/// Verifies that order events are pushed to the correct tenant group in real time.
/// </summary>
public class OrderHubTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;
    private readonly HttpClient _authClient;
    private readonly HttpClient _anonClient;
    private Guid _qrToken;
    private Guid _categoryId;
    private Guid _menuItemId;
    private string _staffToken = null!;

    public OrderHubTests(TestWebAppFactory factory)
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
        var email = $"hub_{Guid.NewGuid():N}@test.com";
        await _authClient.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Hub Tester" });
        var loginResp = await _authClient.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        _staffToken = loginBody.GetProperty("accessToken").GetString()!;
        _authClient.DefaultRequestHeaders.Authorization = new("Bearer", _staffToken);

        var spaceResp = await _authClient.PostAsJsonAsync("/spaces",
            new { name = "Hub Space", cols = 3, rows = 3, sortOrder = 0 });
        var spaceBody = await spaceResp.Content.ReadFromJsonAsync<JsonElement>();
        var spaceId = spaceBody.GetProperty("id").GetString()!;

        var tableResp = await _authClient.PostAsJsonAsync("/tables",
            new { spaceId, number = "HT1", col = 1, row = 1 });
        var tableBody = await tableResp.Content.ReadFromJsonAsync<JsonElement>();
        _qrToken = Guid.Parse(tableBody.GetProperty("qrToken").GetString()!);

        var catResp = await _authClient.PostAsJsonAsync("/categories",
            new { name = "Hub Cat", sortOrder = 0 });
        var catBody = await catResp.Content.ReadFromJsonAsync<JsonElement>();
        _categoryId = Guid.Parse(catBody.GetProperty("id").GetString()!);

        var itemResp = await _authClient.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name = "Hub Burger", price = 7.500m, sortOrder = 0 });
        var itemBody = await itemResp.Content.ReadFromJsonAsync<JsonElement>();
        _menuItemId = Guid.Parse(itemBody.GetProperty("id").GetString()!);
    }

    private HubConnection BuildConnection(string tenant, string? token = null)
    {
        var baseUri = _factory.Server.BaseAddress;
        var hubUri  = new Uri(baseUri, "hubs/orders");

        return new HubConnectionBuilder()
            .WithUrl(hubUri, opts =>
            {
                opts.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                opts.Headers.Add("X-Tenant", tenant);
                if (token is not null)
                    opts.AccessTokenProvider = () => Task.FromResult<string?>(token);
            })
            .Build();
    }

    // ── Connection ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Hub_AnonymousClient_CanConnect()
    {
        var conn = BuildConnection("cafetunisia");
        await conn.StartAsync();

        conn.State.Should().Be(HubConnectionState.Connected);

        await conn.StopAsync();
    }

    [Fact]
    public async Task Hub_AuthenticatedClient_CanConnect()
    {
        var conn = BuildConnection("cafetunisia", _staffToken);
        await conn.StartAsync();

        conn.State.Should().Be(HubConnectionState.Connected);

        await conn.StopAsync();
    }

    // ── OrderPlaced event ─────────────────────────────────────────────────────

    [Fact]
    public async Task PlaceOrder_ConnectedClient_ReceivesOrderPlacedEvent()
    {
        var tcs  = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var conn = BuildConnection("cafetunisia");
        conn.On<JsonElement>("OrderPlaced", payload => tcs.TrySetResult(payload));

        await conn.StartAsync();

        await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 2 } },
        });

        var received = await tcs.Task.WaitAsync(TimeSpan.FromSeconds(5));

        received.GetProperty("status").GetString().Should().Be("Pending");
        received.GetProperty("tableNumber").GetString().Should().Be("HT1");
        received.GetProperty("items").GetArrayLength().Should().Be(1);

        await conn.StopAsync();
    }

    [Fact]
    public async Task PlaceOrder_MultipleClientsOnSameTenant_AllReceiveEvent()
    {
        var tcs1 = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var tcs2 = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);

        var conn1 = BuildConnection("cafetunisia");
        var conn2 = BuildConnection("cafetunisia", _staffToken);

        conn1.On<JsonElement>("OrderPlaced", p => tcs1.TrySetResult(p));
        conn2.On<JsonElement>("OrderPlaced", p => tcs2.TrySetResult(p));

        await conn1.StartAsync();
        await conn2.StartAsync();

        await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 1 } },
        });

        var results = await Task.WhenAll(
            tcs1.Task.WaitAsync(TimeSpan.FromSeconds(5)),
            tcs2.Task.WaitAsync(TimeSpan.FromSeconds(5)));

        results[0].GetProperty("status").GetString().Should().Be("Pending");
        results[1].GetProperty("status").GetString().Should().Be("Pending");

        await conn1.StopAsync();
        await conn2.StopAsync();
    }

    // ── OrderStatusChanged event ──────────────────────────────────────────────

    [Fact]
    public async Task UpdateStatus_ConnectedClient_ReceivesOrderStatusChangedEvent()
    {
        // Place an order first
        var orderResp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 1 } },
        });
        var orderBody = await orderResp.Content.ReadFromJsonAsync<JsonElement>();
        var orderId   = orderBody.GetProperty("id").GetString()!;

        var tcs  = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var conn = BuildConnection("cafetunisia");
        conn.On<JsonElement>("OrderStatusChanged", payload => tcs.TrySetResult(payload));

        await conn.StartAsync();

        await _authClient.PutAsJsonAsync($"/orders/{orderId}/status", new { status = "InProgress" });

        var received = await tcs.Task.WaitAsync(TimeSpan.FromSeconds(5));

        received.GetProperty("id").GetString().Should().Be(orderId);
        received.GetProperty("status").GetString().Should().Be("InProgress");

        await conn.StopAsync();
    }

    // ── OrderCancelled event ──────────────────────────────────────────────────

    [Fact]
    public async Task CancelOrder_ConnectedClient_ReceivesOrderCancelledEvent()
    {
        var orderResp = await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 1 } },
        });
        var orderBody = await orderResp.Content.ReadFromJsonAsync<JsonElement>();
        var orderId   = orderBody.GetProperty("id").GetString()!;

        var tcs  = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var conn = BuildConnection("cafetunisia");
        conn.On<JsonElement>("OrderCancelled", payload => tcs.TrySetResult(payload));

        await conn.StartAsync();

        await _authClient.DeleteAsync($"/orders/{orderId}");

        var received = await tcs.Task.WaitAsync(TimeSpan.FromSeconds(5));

        received.GetProperty("id").GetString().Should().Be(orderId);
        received.GetProperty("status").GetString().Should().Be("Cancelled");

        await conn.StopAsync();
    }

    // ── Tenant isolation ──────────────────────────────────────────────────────

    [Fact]
    public async Task PlaceOrder_ClientOnDifferentTenant_DoesNotReceiveEvent()
    {
        // Connect a restauranttunisia client
        var restoToken = await RegisterAndLoginAsync("restauranttunisia");
        var conn = BuildConnection("restauranttunisia", restoToken);

        var received = false;
        conn.On<JsonElement>("OrderPlaced", _ => received = true);

        await conn.StartAsync();

        // Place an order on cafetunisia
        await _anonClient.PostAsJsonAsync("/orders", new
        {
            qrToken = _qrToken,
            items   = new[] { new { menuItemId = _menuItemId, quantity = 1 } },
        });

        // Wait briefly — no event should arrive
        await Task.Delay(1000);

        received.Should().BeFalse(
            "a restauranttunisia client must not receive events from cafetunisia orders");

        await conn.StopAsync();
    }

    private async Task<string> RegisterAndLoginAsync(string tenant)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", tenant);
        var email = $"hub_{tenant}_{Guid.NewGuid():N}@test.com";
        await client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Hub Isolation" });
        var resp = await client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("accessToken").GetString()!;
    }
}
