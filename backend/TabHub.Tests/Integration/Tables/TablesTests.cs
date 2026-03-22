using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.Tables;

public class TablesTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private string _spaceId = null!;

    public TablesTests(TestWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAsync(factory).GetAwaiter().GetResult();
    }

    private async Task SetupAsync(TestWebAppFactory factory)
    {
        // Authenticate
        var email = $"tables_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Tables Tester" });
        var loginResp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", loginBody.GetProperty("accessToken").GetString()!);

        // Create a space to use as parent
        var spaceResp = await _client.PostAsJsonAsync("/spaces",
            new { name = "Tables Test Space", cols = 5, rows = 5, sortOrder = 0 });
        var spaceBody = await spaceResp.Content.ReadFromJsonAsync<JsonElement>();
        _spaceId = spaceBody.GetProperty("id").GetString()!;
    }

    private object TablePayload(string number = "T1", int col = 1, int row = 1) =>
        new { spaceId = _spaceId, number, col, row };

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateTable_ValidPayload_Returns201()
    {
        var resp = await _client.PostAsJsonAsync("/tables", TablePayload("T-Create"));
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("number").GetString().Should().Be("T-Create");
        body.GetProperty("qrToken").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task CreateTable_UnknownSpaceId_Returns400()
    {
        var resp = await _client.PostAsJsonAsync("/tables",
            new { spaceId = Guid.NewGuid(), number = "T1", col = 1, row = 1 });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListTables_Returns200()
    {
        await _client.PostAsJsonAsync("/tables", TablePayload("T-List"));

        var resp = await _client.GetAsync("/tables");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetArrayLength().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task ListTables_FilterBySpaceId_ReturnsOnlyThatSpace()
    {
        await _client.PostAsJsonAsync("/tables", TablePayload("T-Filter"));

        var resp = await _client.GetAsync($"/tables?spaceId={_spaceId}");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        foreach (var table in body.EnumerateArray())
            table.GetProperty("spaceId").GetString().Should().Be(_spaceId);
    }

    // ── Get ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetTable_ExistingId_Returns200()
    {
        var created = await _client.PostAsJsonAsync("/tables", TablePayload("T-Get"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var resp = await _client.GetAsync($"/tables/{id}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetTable_UnknownId_Returns404()
    {
        var resp = await _client.GetAsync($"/tables/{Guid.NewGuid()}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateTable_ValidPayload_Returns200()
    {
        var created = await _client.PostAsJsonAsync("/tables", TablePayload("T-Update"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/tables/{id}",
            new { number = "T-Updated", col = 2, row = 3, isActive = true });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("number").GetString().Should().Be("T-Updated");
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteTable_ExistingId_Returns204ThenGetReturns404()
    {
        var created = await _client.PostAsJsonAsync("/tables", TablePayload("T-Delete"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var deleteResp = await _client.DeleteAsync($"/tables/{id}");
        var getResp    = await _client.GetAsync($"/tables/{id}");

        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
