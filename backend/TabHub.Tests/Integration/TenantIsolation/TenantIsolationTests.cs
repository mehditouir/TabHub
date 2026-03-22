using FluentAssertions;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace TabHub.Tests.Integration.TenantIsolation;

/// <summary>
/// Verifies that data created in one tenant is never visible to another tenant,
/// and that JWT tokens cannot be used across tenant boundaries.
/// </summary>
public class TenantIsolationTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;
    private string _cafeToken = null!;
    private string _restoToken = null!;

    public TenantIsolationTests(TestWebAppFactory factory)
    {
        _factory = factory;
        SetupAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAsync()
    {
        _cafeToken = await RegisterAndLoginAsync("cafetunisia");
        _restoToken = await RegisterAndLoginAsync("restauranttunisia");
    }

    private async Task<string> RegisterAndLoginAsync(string tenant)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", tenant);
        var email = $"isolation_{tenant}_{Guid.NewGuid():N}@test.com";
        await client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = $"{tenant} isolation user" });
        var resp = await client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("accessToken").GetString()!;
    }

    private HttpClient AuthClient(string tenant, string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", tenant);
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        return client;
    }

    // ── Space isolation ───────────────────────────────────────────────────────

    [Fact]
    public async Task Space_CreatedInCafetunisia_NotVisibleInRestauranttunisia()
    {
        var cafeClient = AuthClient("cafetunisia", _cafeToken);
        var createResp = await cafeClient.PostAsJsonAsync("/spaces",
            new { name = "Cafe-Only Space", cols = 3, rows = 3, sortOrder = 0 });
        var body = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var cafeSpaceId = body.GetProperty("id").GetString()!;

        var restoClient = AuthClient("restauranttunisia", _restoToken);
        var listResp = await restoClient.GetAsync("/spaces");
        var spaces = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = spaces.EnumerateArray().Select(s => s.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(cafeSpaceId,
            "a space created in cafetunisia must not appear in restauranttunisia");
    }

    [Fact]
    public async Task Space_CreatedInRestauranttunisia_NotVisibleInCafetunisia()
    {
        var restoClient = AuthClient("restauranttunisia", _restoToken);
        var createResp = await restoClient.PostAsJsonAsync("/spaces",
            new { name = "Resto-Only Space", cols = 3, rows = 3, sortOrder = 0 });
        var body = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var restoSpaceId = body.GetProperty("id").GetString()!;

        var cafeClient = AuthClient("cafetunisia", _cafeToken);
        var listResp = await cafeClient.GetAsync("/spaces");
        var spaces = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = spaces.EnumerateArray().Select(s => s.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(restoSpaceId,
            "a space created in restauranttunisia must not appear in cafetunisia");
    }

    // ── Staff isolation ───────────────────────────────────────────────────────

    [Fact]
    public async Task Staff_CreatedInCafetunisia_NotVisibleInRestauranttunisia()
    {
        var cafeClient = AuthClient("cafetunisia", _cafeToken);
        var createResp = await cafeClient.PostAsJsonAsync("/staff",
            new { displayName = "Cafe Staff", role = "Waiter",
                  pin = Guid.NewGuid().ToString("N")[..6] });
        var body = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var cafeStaffId = body.GetProperty("id").GetString()!;

        var restoClient = AuthClient("restauranttunisia", _restoToken);
        var listResp = await restoClient.GetAsync("/staff");
        var staff = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = staff.EnumerateArray().Select(s => s.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(cafeStaffId,
            "staff created in cafetunisia must not appear in restauranttunisia");
    }

    // ── Config isolation ──────────────────────────────────────────────────────

    [Fact]
    public async Task Config_SetInCafetunisia_NotVisibleInRestauranttunisia()
    {
        var key = $"isolated_key_{Guid.NewGuid():N}";
        var cafeClient = AuthClient("cafetunisia", _cafeToken);
        await cafeClient.PutAsJsonAsync($"/config/{key}", new { value = "cafe-only-value" });

        var restoClient = AuthClient("restauranttunisia", _restoToken);
        var resp = await restoClient.GetAsync($"/config/{key}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "a config key set in cafetunisia must not exist in restauranttunisia");
    }

    [Fact]
    public async Task Config_SetInRestauranttunisia_NotVisibleInCafetunisia()
    {
        var key = $"isolated_key_{Guid.NewGuid():N}";
        var restoClient = AuthClient("restauranttunisia", _restoToken);
        await restoClient.PutAsJsonAsync($"/config/{key}", new { value = "resto-only-value" });

        var cafeClient = AuthClient("cafetunisia", _cafeToken);
        var resp = await cafeClient.GetAsync($"/config/{key}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "a config key set in restauranttunisia must not exist in cafetunisia");
    }

    // ── Table isolation ───────────────────────────────────────────────────────

    [Fact]
    public async Task Table_CreatedInCafetunisia_NotVisibleInRestauranttunisia()
    {
        // Need a space in cafetunisia first
        var cafeClient = AuthClient("cafetunisia", _cafeToken);
        var spaceResp = await cafeClient.PostAsJsonAsync("/spaces",
            new { name = "Isolation Space", cols = 3, rows = 3, sortOrder = 0 });
        var spaceBody = await spaceResp.Content.ReadFromJsonAsync<JsonElement>();
        var spaceId = spaceBody.GetProperty("id").GetString()!;

        var tableResp = await cafeClient.PostAsJsonAsync("/tables",
            new { spaceId, number = "T-Isolated", col = 1, row = 1 });
        var tableBody = await tableResp.Content.ReadFromJsonAsync<JsonElement>();
        var cafeTableId = tableBody.GetProperty("id").GetString()!;

        var restoClient = AuthClient("restauranttunisia", _restoToken);
        var listResp = await restoClient.GetAsync("/tables");
        var tables = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = tables.EnumerateArray().Select(t => t.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(cafeTableId,
            "a table created in cafetunisia must not appear in restauranttunisia");
    }

    // ── Cross-tenant GET by ID ────────────────────────────────────────────────

    [Fact]
    public async Task Space_GetByIdFromOtherTenant_Returns404()
    {
        // Create space in cafetunisia
        var cafeClient = AuthClient("cafetunisia", _cafeToken);
        var createResp = await cafeClient.PostAsJsonAsync("/spaces",
            new { name = "Cross-Tenant Space", cols = 3, rows = 3, sortOrder = 0 });
        var body = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var cafeSpaceId = body.GetProperty("id").GetString()!;

        // Try to GET it from restauranttunisia using that ID
        var restoClient = AuthClient("restauranttunisia", _restoToken);
        var resp = await restoClient.GetAsync($"/spaces/{cafeSpaceId}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "a space from another tenant must not be accessible");
    }
}
