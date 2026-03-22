using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.Staff;

public class StaffTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebAppFactory _factory;
    private string _spaceId = null!;

    public StaffTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAsync()
    {
        var email = $"staff_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Staff Tester" });
        var loginResp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", loginBody.GetProperty("accessToken").GetString()!);

        var spaceResp = await _client.PostAsJsonAsync("/spaces",
            new { name = "Staff Test Space", cols = 5, rows = 5, sortOrder = 0 });
        var spaceBody = await spaceResp.Content.ReadFromJsonAsync<JsonElement>();
        _spaceId = spaceBody.GetProperty("id").GetString()!;
    }

    private static object StaffPayload(string name = "Ahmed", string role = "Waiter", string pin = "1234") =>
        new { displayName = name, role, pin };

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateStaff_ValidPayload_Returns201()
    {
        var resp = await _client.PostAsJsonAsync("/staff", StaffPayload("Ahmed Waiter"));
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("displayName").GetString().Should().Be("Ahmed Waiter");
        body.GetProperty("role").GetString().Should().Be("Waiter");
    }

    [Fact]
    public async Task CreateStaff_InvalidRole_Returns400()
    {
        var resp = await _client.PostAsJsonAsync("/staff",
            new { displayName = "Test", role = "InvalidRole", pin = "1234" });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListStaff_Returns200()
    {
        await _client.PostAsJsonAsync("/staff", StaffPayload("Ahmed List"));

        var resp = await _client.GetAsync("/staff");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetArrayLength().Should().BeGreaterThan(0);
    }

    // ── Get ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetStaff_ExistingId_Returns200()
    {
        var created = await _client.PostAsJsonAsync("/staff", StaffPayload("Ahmed Get"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var resp = await _client.GetAsync($"/staff/{id}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetStaff_UnknownId_Returns404()
    {
        var resp = await _client.GetAsync($"/staff/{Guid.NewGuid()}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateStaff_ValidPayload_Returns200()
    {
        var created = await _client.PostAsJsonAsync("/staff", StaffPayload("Ahmed Update"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/staff/{id}",
            new { displayName = "Ahmed Updated", role = "Kitchen", isActive = true });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("displayName").GetString().Should().Be("Ahmed Updated");
        body.GetProperty("role").GetString().Should().Be("Kitchen");
    }

    // ── Set PIN ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task SetPin_ValidPin_Returns204()
    {
        var created = await _client.PostAsJsonAsync("/staff", StaffPayload("Ahmed Pin"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/staff/{id}/pin", new { pin = "5678" });

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteStaff_ExistingId_Returns204ThenGetReturns404()
    {
        var created = await _client.PostAsJsonAsync("/staff", StaffPayload("Ahmed Delete"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var deleteResp = await _client.DeleteAsync($"/staff/{id}");
        var getResp    = await _client.GetAsync($"/staff/{id}");

        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Staff PIN Login ───────────────────────────────────────────────────────

    [Fact]
    public async Task StaffPinLogin_CorrectPin_Returns200WithToken()
    {
        var pin = Guid.NewGuid().ToString("N")[..4]; // unique 4-char PIN per test
        await _client.PostAsJsonAsync("/staff", StaffPayload("Ahmed PinLogin", pin: pin));

        var unauthClient = _factory.CreateClient();
        unauthClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        var resp = await unauthClient.PostAsJsonAsync("/auth/staff/pin-login", new { pin });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("accessToken").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("role").GetString().Should().Be("waiter");
    }

    [Fact]
    public async Task StaffPinLogin_WrongPin_Returns401()
    {
        var unauthClient = _factory.CreateClient();
        unauthClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        var resp = await unauthClient.PostAsJsonAsync("/auth/staff/pin-login",
            new { pin = "0000" });

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Waiter Zones ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetZones_NewStaff_ReturnsEmptyArray()
    {
        var created = await _client.PostAsJsonAsync("/staff", StaffPayload("Ahmed Zones"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var resp = await _client.GetAsync($"/staff/{id}/zones");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task AddZone_ValidPayload_Returns201()
    {
        var created = await _client.PostAsJsonAsync("/staff", StaffPayload("Ahmed AddZone"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var staffId = createdBody.GetProperty("id").GetString();

        var resp = await _client.PostAsJsonAsync($"/staff/{staffId}/zones",
            new { spaceId = _spaceId, colStart = 1, colEnd = 3, rowStart = 1, rowEnd = 2 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task RemoveZone_ExistingZone_Returns204()
    {
        var created = await _client.PostAsJsonAsync("/staff", StaffPayload("Ahmed RemoveZone"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var staffId = createdBody.GetProperty("id").GetString();

        var zoneResp = await _client.PostAsJsonAsync($"/staff/{staffId}/zones",
            new { spaceId = _spaceId, colStart = 1, colEnd = 2, rowStart = 1, rowEnd = 1 });
        var zoneBody = await zoneResp.Content.ReadFromJsonAsync<JsonElement>();
        var zoneId = zoneBody.GetProperty("id").GetString();

        var resp = await _client.DeleteAsync($"/staff/{staffId}/zones/{zoneId}");

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }
}
