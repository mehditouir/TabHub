using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.Menu;

/// <summary>
/// Tests for the public GET /menu endpoint (no auth required).
/// </summary>
public class PublicMenuTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _authClient;
    private readonly HttpClient _anonClient;
    private readonly TestWebAppFactory _factory;

    public PublicMenuTests(TestWebAppFactory factory)
    {
        _factory = factory;

        _authClient = factory.CreateClient();
        _authClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        _anonClient = factory.CreateClient();
        _anonClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        SetupAuthAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAuthAsync()
    {
        var email = $"menu_{Guid.NewGuid():N}@test.com";
        await _authClient.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Menu Tester" });
        var resp = await _authClient.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        _authClient.DefaultRequestHeaders.Authorization =
            new("Bearer", body.GetProperty("accessToken").GetString()!);
    }

    private async Task<Guid> CreateCategoryAsync(string name, bool isActive = true)
    {
        var resp = await _authClient.PostAsJsonAsync("/categories", new { name, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var id = Guid.Parse(body.GetProperty("id").GetString()!);

        if (!isActive)
        {
            await _authClient.PutAsJsonAsync($"/categories/{id}",
                new { name, sortOrder = 0, isActive = false });
        }

        return id;
    }

    private async Task<Guid> CreateItemAsync(Guid categoryId, string name, decimal price,
        bool isAvailable = true)
    {
        var resp = await _authClient.PostAsJsonAsync("/menu-items",
            new { categoryId, name, price, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var id = Guid.Parse(body.GetProperty("id").GetString()!);

        if (!isAvailable)
        {
            await _authClient.PutAsJsonAsync($"/menu-items/{id}", new
            {
                categoryId,
                name,
                price,
                isAvailable = false,
                sortOrder   = 0,
            });
        }

        return id;
    }

    // ── No auth required ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetMenu_NoAuth_Returns200()
    {
        var resp = await _anonClient.GetAsync("/menu");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── Response structure ────────────────────────────────────────────────────

    [Fact]
    public async Task GetMenu_ReturnsTenantSlugAndCategories()
    {
        var resp = await _anonClient.GetAsync("/menu");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        body.GetProperty("tenant").GetString().Should().Be("cafetunisia");
        body.TryGetProperty("categories", out _).Should().BeTrue();
    }

    [Fact]
    public async Task GetMenu_ActiveCategoryWithItems_AppearsInResponse()
    {
        var catId = await CreateCategoryAsync($"Pub Cat {Guid.NewGuid():N}");
        await CreateItemAsync(catId, $"Pub Item {Guid.NewGuid():N}", 5.0m);

        var resp = await _anonClient.GetAsync("/menu");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var categories = body.GetProperty("categories").EnumerateArray().ToList();
        categories.Should().NotBeEmpty();
    }

    // ── Filtering rules ───────────────────────────────────────────────────────

    [Fact]
    public async Task GetMenu_InactiveCategory_NotIncluded()
    {
        var inactiveCatName = $"Inactive Pub Cat {Guid.NewGuid():N}";
        await CreateCategoryAsync(inactiveCatName, isActive: false);

        var resp = await _anonClient.GetAsync("/menu");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var categories = body.GetProperty("categories").EnumerateArray().ToList();
        categories.Should().NotContain(c => c.GetProperty("name").GetString() == inactiveCatName);
    }

    [Fact]
    public async Task GetMenu_UnavailableItem_NotIncludedInCategory()
    {
        var catId = await CreateCategoryAsync($"Mixed Cat {Guid.NewGuid():N}");
        var unavailableName = $"Unavail {Guid.NewGuid():N}";
        var availableName   = $"Avail {Guid.NewGuid():N}";

        await CreateItemAsync(catId, unavailableName, 3.0m, isAvailable: false);
        await CreateItemAsync(catId, availableName,   4.0m, isAvailable: true);

        var resp = await _anonClient.GetAsync("/menu");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var allItems = body.GetProperty("categories")
            .EnumerateArray()
            .SelectMany(c => c.GetProperty("items").EnumerateArray())
            .ToList();

        allItems.Should().NotContain(i => i.GetProperty("name").GetString() == unavailableName,
            "unavailable items must be hidden from public menu");
        allItems.Should().Contain(i => i.GetProperty("name").GetString() == availableName,
            "available items must appear in public menu");
    }

    [Fact]
    public async Task GetMenu_DeletedItem_NotIncluded()
    {
        var catId = await CreateCategoryAsync($"Del Item Cat {Guid.NewGuid():N}");
        var deletedName = $"Deleted {Guid.NewGuid():N}";
        var itemId = await CreateItemAsync(catId, deletedName, 3.0m);

        await _authClient.DeleteAsync($"/menu-items/{itemId}");

        var resp = await _anonClient.GetAsync("/menu");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var allItemNames = body.GetProperty("categories")
            .EnumerateArray()
            .SelectMany(c => c.GetProperty("items").EnumerateArray())
            .Select(i => i.GetProperty("name").GetString())
            .ToList();

        allItemNames.Should().NotContain(deletedName, "deleted items must not appear in public menu");
    }

    // ── Translations ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetMenu_ItemWithTranslation_TranslationsIncluded()
    {
        var catId = await CreateCategoryAsync($"Trans Cat {Guid.NewGuid():N}");
        var itemId = await CreateItemAsync(catId, "Coffee", 2.5m);

        await _authClient.PutAsJsonAsync($"/menu-items/{itemId}/translations/fr",
            new { name = "Café" });

        var resp = await _anonClient.GetAsync("/menu");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var allItems = body.GetProperty("categories")
            .EnumerateArray()
            .SelectMany(c => c.GetProperty("items").EnumerateArray())
            .ToList();

        var coffeeItem = allItems.FirstOrDefault(i =>
            i.GetProperty("id").GetString() == itemId.ToString());

        coffeeItem.Should().NotBeNull();
        var translations = coffeeItem!.GetProperty("translations").EnumerateArray().ToList();
        translations.Should().Contain(t =>
            t.GetProperty("language").GetString() == "FR" &&
            t.GetProperty("name").GetString() == "Café");
    }
}
