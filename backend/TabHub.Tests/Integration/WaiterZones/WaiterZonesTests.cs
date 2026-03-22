using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.WaiterZones;

public class WaiterZonesTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebAppFactory _factory;
    private Guid _staffId;
    private Guid _spaceId;

    public WaiterZonesTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client  = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAsync()
    {
        var email = $"wz_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Zone Tester" });
        var loginResp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", loginBody.GetProperty("accessToken").GetString()!);

        var spaceResp = await _client.PostAsJsonAsync("/spaces",
            new { name = "Zone Space", cols = 10, rows = 8, sortOrder = 0 });
        var spaceBody = await spaceResp.Content.ReadFromJsonAsync<JsonElement>();
        _spaceId = Guid.Parse(spaceBody.GetProperty("id").GetString()!);

        var staffResp = await _client.PostAsJsonAsync("/staff",
            new { displayName = "Waiter Ali", role = "Waiter", pin = "1234" });
        var staffBody = await staffResp.Content.ReadFromJsonAsync<JsonElement>();
        _staffId = Guid.Parse(staffBody.GetProperty("id").GetString()!);
    }

    private async Task<(HttpResponseMessage Resp, JsonElement Body)> AddZoneAsync(
        Guid? staffId = null, Guid? spaceId = null,
        int colStart = 0, int colEnd = 4, int rowStart = 0, int rowEnd = 3)
    {
        var resp = await _client.PostAsJsonAsync($"/staff/{staffId ?? _staffId}/zones", new
        {
            spaceId  = spaceId ?? _spaceId,
            colStart,
            colEnd,
            rowStart,
            rowEnd,
        });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return (resp, body);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task AddZone_ValidPayload_Returns201WithId()
    {
        var (resp, body) = await AddZoneAsync();

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("spaceId").GetString().Should().Be(_spaceId.ToString());
        body.GetProperty("colStart").GetInt32().Should().Be(0);
        body.GetProperty("colEnd").GetInt32().Should().Be(4);
    }

    [Fact]
    public async Task AddZone_UnknownStaff_Returns404()
    {
        var (resp, _) = await AddZoneAsync(staffId: Guid.NewGuid());

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AddZone_UnknownSpace_Returns400()
    {
        var (resp, _) = await AddZoneAsync(spaceId: Guid.NewGuid());

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddZone_ColStartGreaterThanColEnd_Returns400()
    {
        var (resp, body) = await AddZoneAsync(colStart: 5, colEnd: 2);

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        body.GetProperty("error").GetString().Should().Contain("ColStart");
    }

    [Fact]
    public async Task AddZone_RowStartGreaterThanRowEnd_Returns400()
    {
        var (resp, body) = await AddZoneAsync(rowStart: 7, rowEnd: 3);

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        body.GetProperty("error").GetString().Should().Contain("RowStart");
    }

    [Fact]
    public async Task AddZone_SingleCell_ColStartEqualsColEnd_Returns201()
    {
        // A 1x1 zone (single table cell) is valid
        var (resp, _) = await AddZoneAsync(colStart: 3, colEnd: 3, rowStart: 2, rowEnd: 2);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListZones_Returns200WithAddedZones()
    {
        await AddZoneAsync(colStart: 0, colEnd: 2, rowStart: 0, rowEnd: 1);
        await AddZoneAsync(colStart: 3, colEnd: 5, rowStart: 0, rowEnd: 1);

        var resp = await _client.GetAsync($"/staff/{_staffId}/zones");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetArrayLength().Should().BeGreaterThanOrEqualTo(2);
    }

    [Fact]
    public async Task ListZones_EmptyForNewStaff_Returns200WithEmptyArray()
    {
        var staffResp = await _client.PostAsJsonAsync("/staff",
            new { displayName = "Fresh Waiter", role = "Waiter", pin = "9999" });
        var staffBody = await staffResp.Content.ReadFromJsonAsync<JsonElement>();
        var freshId = staffBody.GetProperty("id").GetString()!;

        var resp = await _client.GetAsync($"/staff/{freshId}/zones");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetArrayLength().Should().Be(0);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task RemoveZone_ExistingZone_Returns204AndDisappears()
    {
        var (_, created) = await AddZoneAsync();
        var zoneId = created.GetProperty("id").GetString()!;

        var deleteResp = await _client.DeleteAsync($"/staff/{_staffId}/zones/{zoneId}");

        var listResp = await _client.GetAsync($"/staff/{_staffId}/zones");
        var zones    = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = zones.EnumerateArray().Select(z => z.GetProperty("id").GetString()).ToList();

        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);
        ids.Should().NotContain(zoneId);
    }

    [Fact]
    public async Task RemoveZone_UnknownZoneId_Returns404()
    {
        var resp = await _client.DeleteAsync($"/staff/{_staffId}/zones/{Guid.NewGuid()}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RemoveZone_ZoneBelongingToOtherStaff_Returns404()
    {
        // Create a second staff member and add a zone to them
        var staff2Resp = await _client.PostAsJsonAsync("/staff",
            new { displayName = "Waiter Two", role = "Waiter", pin = "5678" });
        var staff2Body = await staff2Resp.Content.ReadFromJsonAsync<JsonElement>();
        var staff2Id = Guid.Parse(staff2Body.GetProperty("id").GetString()!);

        var (_, zone) = await AddZoneAsync(staffId: staff2Id);
        var zoneId = zone.GetProperty("id").GetString()!;

        // Try to delete it via _staffId (wrong staff)
        var resp = await _client.DeleteAsync($"/staff/{_staffId}/zones/{zoneId}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Auth guard ────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListZones_NoToken_Returns401()
    {
        var unauthClient = _factory.CreateClient();
        unauthClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        var resp = await unauthClient.GetAsync($"/staff/{_staffId}/zones");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Tenant isolation ──────────────────────────────────────────────────────

    [Fact]
    public async Task AddZone_StaffFromOtherTenant_CannotSeeZone()
    {
        // Add a zone for cafetunisia staff
        var (_, created) = await AddZoneAsync();
        var zoneId = created.GetProperty("id").GetString()!;

        // restauranttunisia staff cannot see cafetunisia zones
        var restoEmail = $"wz_resto_{Guid.NewGuid():N}@test.com";
        var restoClient = _factory.CreateClient();
        restoClient.DefaultRequestHeaders.Add("X-Tenant", "restauranttunisia");
        await restoClient.PostAsJsonAsync("/auth/register",
            new { email = restoEmail, password = "Test123!", displayName = "Resto Wz" });
        var restoLogin = await restoClient.PostAsJsonAsync("/auth/login",
            new { email = restoEmail, password = "Test123!" });
        var restoBody = await restoLogin.Content.ReadFromJsonAsync<JsonElement>();
        restoClient.DefaultRequestHeaders.Authorization =
            new("Bearer", restoBody.GetProperty("accessToken").GetString()!);

        var resp = await restoClient.GetAsync($"/staff/{_staffId}/zones");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = body.EnumerateArray().Select(z => z.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(zoneId,
            "zones from cafetunisia must not appear in restauranttunisia");
    }
}
