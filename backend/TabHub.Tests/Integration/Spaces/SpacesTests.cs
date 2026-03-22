using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.Spaces;

public class SpacesTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebAppFactory _factory;

    public SpacesTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAuthAsync(factory).GetAwaiter().GetResult();
    }

    private async Task SetupAuthAsync(TestWebAppFactory factory)
    {
        var email = $"spaces_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Spaces Tester" });
        var resp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", body.GetProperty("accessToken").GetString()!);
    }

    private static object SpacePayload(string name = "Main Hall", int cols = 5, int rows = 4) =>
        new { name, cols, rows, sortOrder = 0 };

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateSpace_ValidPayload_Returns201()
    {
        var resp = await _client.PostAsJsonAsync("/spaces", SpacePayload("Hall A"));
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("name").GetString().Should().Be("Hall A");
        body.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
    }

    // ── List ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListSpaces_Returns200WithCreatedSpace()
    {
        await _client.PostAsJsonAsync("/spaces", SpacePayload("Hall List"));

        var resp = await _client.GetAsync("/spaces");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetArrayLength().Should().BeGreaterThan(0);
    }

    // ── Get ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetSpace_ExistingId_Returns200()
    {
        var created = await _client.PostAsJsonAsync("/spaces", SpacePayload("Hall Get"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var resp = await _client.GetAsync($"/spaces/{id}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetSpace_UnknownId_Returns404()
    {
        var resp = await _client.GetAsync($"/spaces/{Guid.NewGuid()}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateSpace_ValidPayload_Returns200WithUpdatedName()
    {
        var created = await _client.PostAsJsonAsync("/spaces", SpacePayload("Hall Update"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/spaces/{id}",
            new { name = "Hall Updated", cols = 6, rows = 5, sortOrder = 1, isActive = true });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("name").GetString().Should().Be("Hall Updated");
        body.GetProperty("cols").GetInt32().Should().Be(6);
    }

    // ── Translation ───────────────────────────────────────────────────────────

    [Fact]
    public async Task SetTranslation_ValidLanguage_Returns204()
    {
        var created = await _client.PostAsJsonAsync("/spaces", SpacePayload("Hall Trans"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/spaces/{id}/translations/fr",
            new { name = "Salle Principale" });

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task SetTranslation_InvalidLanguage_Returns400()
    {
        var created = await _client.PostAsJsonAsync("/spaces", SpacePayload("Hall Trans2"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/spaces/{id}/translations/xx",
            new { name = "Unknown" });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteSpace_ExistingId_Returns204ThenGetReturns404()
    {
        var created = await _client.PostAsJsonAsync("/spaces", SpacePayload("Hall Delete"));
        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = createdBody.GetProperty("id").GetString();

        var deleteResp = await _client.DeleteAsync($"/spaces/{id}");
        var getResp    = await _client.GetAsync($"/spaces/{id}");

        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Auth guard ────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListSpaces_NoToken_Returns401()
    {
        var unauthClient = _factory.CreateClient();
        unauthClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        var resp = await unauthClient.GetAsync("/spaces");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
