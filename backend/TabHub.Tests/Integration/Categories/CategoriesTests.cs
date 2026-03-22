using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.Categories;

public class CategoriesTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebAppFactory _factory;

    public CategoriesTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAuthAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAuthAsync()
    {
        var email = $"cat_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Category Tester" });
        var resp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", body.GetProperty("accessToken").GetString()!);
    }

    private async Task<(HttpResponseMessage Resp, JsonElement Body)> CreateCategoryAsync(string name = "Starters", int sortOrder = 0)
    {
        var resp = await _client.PostAsJsonAsync("/categories", new { name, sortOrder });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return (resp, body);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateCategory_ValidPayload_Returns201WithId()
    {
        var (resp, body) = await CreateCategoryAsync("Drinks");

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("name").GetString().Should().Be("Drinks");
        body.GetProperty("isActive").GetBoolean().Should().BeTrue();
    }

    // ── List ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListCategories_Returns200WithCreatedCategory()
    {
        await CreateCategoryAsync("Desserts");

        var resp = await _client.GetAsync("/categories");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetArrayLength().Should().BeGreaterThan(0);
    }

    // ── Get ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetCategory_ExistingId_Returns200WithCorrectData()
    {
        var (_, created) = await CreateCategoryAsync("Salads");
        var id = created.GetProperty("id").GetString();

        var resp = await _client.GetAsync($"/categories/{id}");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("name").GetString().Should().Be("Salads");
    }

    [Fact]
    public async Task GetCategory_UnknownId_Returns404()
    {
        var resp = await _client.GetAsync($"/categories/{Guid.NewGuid()}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateCategory_ValidPayload_Returns200WithUpdatedData()
    {
        var (_, created) = await CreateCategoryAsync("Soups");
        var id = created.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/categories/{id}",
            new { name = "Hot Soups", sortOrder = 2, isActive = true });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("name").GetString().Should().Be("Hot Soups");
        body.GetProperty("sortOrder").GetInt32().Should().Be(2);
    }

    [Fact]
    public async Task UpdateCategory_CanDeactivate()
    {
        var (_, created) = await CreateCategoryAsync("Inactive Cat");
        var id = created.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/categories/{id}",
            new { name = "Inactive Cat", sortOrder = 0, isActive = false });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("isActive").GetBoolean().Should().BeFalse();
    }

    // ── Translation ───────────────────────────────────────────────────────────

    [Fact]
    public async Task SetTranslation_ValidLanguage_Returns204AndAppearsInGet()
    {
        var (_, created) = await CreateCategoryAsync("Mains");
        var id = created.GetProperty("id").GetString();

        var putResp = await _client.PutAsJsonAsync($"/categories/{id}/translations/fr",
            new { name = "Plats principaux" });

        var getResp = await _client.GetAsync($"/categories/{id}");
        var body = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        var translations = body.GetProperty("translations").EnumerateArray().ToList();

        putResp.StatusCode.Should().Be(HttpStatusCode.NoContent);
        translations.Should().Contain(t =>
            t.GetProperty("language").GetString() == "FR" &&
            t.GetProperty("name").GetString() == "Plats principaux");
    }

    [Fact]
    public async Task SetTranslation_UpdateExisting_OverwritesName()
    {
        var (_, created) = await CreateCategoryAsync("Burgers");
        var id = created.GetProperty("id").GetString();

        await _client.PutAsJsonAsync($"/categories/{id}/translations/ar",
            new { name = "برغر" });
        await _client.PutAsJsonAsync($"/categories/{id}/translations/ar",
            new { name = "برغر محدث" });

        var getResp = await _client.GetAsync($"/categories/{id}");
        var body = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        var translations = body.GetProperty("translations").EnumerateArray().ToList();

        translations.Should().ContainSingle(t => t.GetProperty("language").GetString() == "AR")
            .Which.GetProperty("name").GetString().Should().Be("برغر محدث");
    }

    [Fact]
    public async Task SetTranslation_InvalidLanguage_Returns400()
    {
        var (_, created) = await CreateCategoryAsync("Pizza");
        var id = created.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/categories/{id}/translations/xx",
            new { name = "Unknown" });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteCategory_Returns204ThenGetReturns404()
    {
        var (_, created) = await CreateCategoryAsync("To Delete");
        var id = created.GetProperty("id").GetString();

        var deleteResp = await _client.DeleteAsync($"/categories/{id}");
        var getResp    = await _client.GetAsync($"/categories/{id}");

        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Auth guard ────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListCategories_NoToken_Returns401()
    {
        var unauthClient = _factory.CreateClient();
        unauthClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        var resp = await unauthClient.GetAsync("/categories");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
