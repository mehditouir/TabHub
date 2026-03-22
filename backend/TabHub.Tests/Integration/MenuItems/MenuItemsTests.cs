using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.MenuItems;

public class MenuItemsTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebAppFactory _factory;
    private Guid _categoryId;

    public MenuItemsTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAsync()
    {
        var email = $"item_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Item Tester" });
        var resp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", body.GetProperty("accessToken").GetString()!);

        var catResp = await _client.PostAsJsonAsync("/categories", new { name = "Test Category", sortOrder = 0 });
        var catBody = await catResp.Content.ReadFromJsonAsync<JsonElement>();
        _categoryId = Guid.Parse(catBody.GetProperty("id").GetString()!);
    }

    private async Task<(HttpResponseMessage Resp, JsonElement Body)> CreateItemAsync(
        string name = "Espresso", decimal price = 2.5m)
    {
        var resp = await _client.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name, price, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return (resp, body);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateMenuItem_ValidPayload_Returns201()
    {
        var (resp, body) = await CreateItemAsync("Latte", 3.0m);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("name").GetString().Should().Be("Latte");
        body.GetProperty("price").GetDecimal().Should().Be(3.0m);
        body.GetProperty("isAvailable").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task CreateMenuItem_WithOptionalFields_StoresThemCorrectly()
    {
        var resp = await _client.PostAsJsonAsync("/menu-items", new
        {
            categoryId  = _categoryId,
            name        = "Cappuccino",
            price       = 3.5m,
            description = "Rich espresso with milk foam",
            imageUrl    = "https://example.com/cappuccino.jpg",
            sortOrder   = 1,
        });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        body.GetProperty("description").GetString().Should().Be("Rich espresso with milk foam");
        body.GetProperty("imageUrl").GetString().Should().Be("https://example.com/cappuccino.jpg");
    }

    // ── List ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListMenuItems_Returns200WithCreatedItem()
    {
        await CreateItemAsync("Americano");

        var resp = await _client.GetAsync("/menu-items");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetArrayLength().Should().BeGreaterThan(0);
    }

    // ── Get ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetMenuItem_ExistingId_Returns200()
    {
        var (_, created) = await CreateItemAsync("Macchiato");
        var id = created.GetProperty("id").GetString();

        var resp = await _client.GetAsync($"/menu-items/{id}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetMenuItem_UnknownId_Returns404()
    {
        var resp = await _client.GetAsync($"/menu-items/{Guid.NewGuid()}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateMenuItem_ValidPayload_Returns200WithUpdatedFields()
    {
        var (_, created) = await CreateItemAsync("Flat White");
        var id = created.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/menu-items/{id}", new
        {
            categoryId  = _categoryId,
            name        = "Flat White Updated",
            price       = 4.0m,
            isAvailable = true,
            sortOrder   = 2,
        });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("name").GetString().Should().Be("Flat White Updated");
        body.GetProperty("price").GetDecimal().Should().Be(4.0m);
    }

    [Fact]
    public async Task UpdateMenuItem_CanMarkUnavailable()
    {
        var (_, created) = await CreateItemAsync("Mocha");
        var id = created.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/menu-items/{id}", new
        {
            categoryId  = _categoryId,
            name        = "Mocha",
            price       = 3.5m,
            isAvailable = false,
            sortOrder   = 0,
        });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("isAvailable").GetBoolean().Should().BeFalse();
    }

    // ── Translation ───────────────────────────────────────────────────────────

    [Fact]
    public async Task SetTranslation_ValidLanguage_Returns204AndAppearsInGet()
    {
        var (_, created) = await CreateItemAsync("Coffee");
        var id = created.GetProperty("id").GetString();

        var putResp = await _client.PutAsJsonAsync($"/menu-items/{id}/translations/fr",
            new { name = "Café", description = "Café expresso" });

        var getResp = await _client.GetAsync($"/menu-items/{id}");
        var body = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        var translations = body.GetProperty("translations").EnumerateArray().ToList();

        putResp.StatusCode.Should().Be(HttpStatusCode.NoContent);
        translations.Should().Contain(t =>
            t.GetProperty("language").GetString() == "FR" &&
            t.GetProperty("name").GetString() == "Café");
    }

    [Fact]
    public async Task SetTranslation_UpdateExisting_OverwritesValues()
    {
        var (_, created) = await CreateItemAsync("Tea");
        var id = created.GetProperty("id").GetString();

        await _client.PutAsJsonAsync($"/menu-items/{id}/translations/ar",
            new { name = "شاي", description = "شاي عربي" });
        await _client.PutAsJsonAsync($"/menu-items/{id}/translations/ar",
            new { name = "شاي محدث" });

        var getResp = await _client.GetAsync($"/menu-items/{id}");
        var body = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        var translations = body.GetProperty("translations").EnumerateArray().ToList();

        translations.Should().ContainSingle(t => t.GetProperty("language").GetString() == "AR")
            .Which.GetProperty("name").GetString().Should().Be("شاي محدث");
    }

    [Fact]
    public async Task SetTranslation_InvalidLanguage_Returns400()
    {
        var (_, created) = await CreateItemAsync("Juice");
        var id = created.GetProperty("id").GetString();

        var resp = await _client.PutAsJsonAsync($"/menu-items/{id}/translations/zz",
            new { name = "Unknown" });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteMenuItem_Returns204ThenGetReturns404()
    {
        var (_, created) = await CreateItemAsync("Soda");
        var id = created.GetProperty("id").GetString();

        var deleteResp = await _client.DeleteAsync($"/menu-items/{id}");
        var getResp    = await _client.GetAsync($"/menu-items/{id}");

        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Auth guard ────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListMenuItems_NoToken_Returns401()
    {
        var unauthClient = _factory.CreateClient();
        unauthClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        var resp = await unauthClient.GetAsync("/menu-items");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
