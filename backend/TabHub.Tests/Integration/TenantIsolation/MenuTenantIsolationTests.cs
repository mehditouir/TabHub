using FluentAssertions;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace TabHub.Tests.Integration.TenantIsolation;

/// <summary>
/// Verifies that categories and menu items are isolated between tenants.
/// </summary>
public class MenuTenantIsolationTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;
    private string _cafeToken = null!;
    private string _restoToken = null!;

    public MenuTenantIsolationTests(TestWebAppFactory factory)
    {
        _factory = factory;
        SetupAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAsync()
    {
        _cafeToken  = await RegisterAndLoginAsync("cafetunisia");
        _restoToken = await RegisterAndLoginAsync("restauranttunisia");
    }

    private async Task<string> RegisterAndLoginAsync(string tenant)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", tenant);
        var email = $"menuiso_{tenant}_{Guid.NewGuid():N}@test.com";
        await client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = $"{tenant} menu isolation" });
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

    private async Task<Guid> CreateCategoryAsync(HttpClient client, string name)
    {
        var resp = await client.PostAsJsonAsync("/categories", new { name, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return Guid.Parse(body.GetProperty("id").GetString()!);
    }

    private async Task<Guid> CreateItemAsync(HttpClient client, Guid categoryId, string name)
    {
        var resp = await client.PostAsJsonAsync("/menu-items",
            new { categoryId, name, price = 5.0m, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return Guid.Parse(body.GetProperty("id").GetString()!);
    }

    // ── Category isolation ────────────────────────────────────────────────────

    [Fact]
    public async Task Category_CreatedInCafe_NotVisibleInRestaurant()
    {
        var cafeClient  = AuthClient("cafetunisia", _cafeToken);
        var restoClient = AuthClient("restauranttunisia", _restoToken);

        var catId = await CreateCategoryAsync(cafeClient, $"Cafe Cat {Guid.NewGuid():N}");

        var listResp = await restoClient.GetAsync("/categories");
        var body = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = body.EnumerateArray().Select(c => c.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(catId.ToString(),
            "a category from cafetunisia must not appear in restauranttunisia");
    }

    [Fact]
    public async Task Category_GetByIdFromOtherTenant_Returns404()
    {
        var cafeClient  = AuthClient("cafetunisia", _cafeToken);
        var restoClient = AuthClient("restauranttunisia", _restoToken);

        var catId = await CreateCategoryAsync(cafeClient, $"Cross Cat {Guid.NewGuid():N}");

        var resp = await restoClient.GetAsync($"/categories/{catId}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "a category from another tenant must not be accessible via GET by ID");
    }

    // ── MenuItem isolation ────────────────────────────────────────────────────

    [Fact]
    public async Task MenuItem_CreatedInCafe_NotVisibleInRestaurant()
    {
        var cafeClient  = AuthClient("cafetunisia", _cafeToken);
        var restoClient = AuthClient("restauranttunisia", _restoToken);

        var catId  = await CreateCategoryAsync(cafeClient, $"Iso Cat {Guid.NewGuid():N}");
        var itemId = await CreateItemAsync(cafeClient, catId, $"Cafe Item {Guid.NewGuid():N}");

        var listResp = await restoClient.GetAsync("/menu-items");
        var body = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = body.EnumerateArray().Select(i => i.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(itemId.ToString(),
            "a menu item from cafetunisia must not appear in restauranttunisia");
    }

    [Fact]
    public async Task MenuItem_GetByIdFromOtherTenant_Returns404()
    {
        var cafeClient  = AuthClient("cafetunisia", _cafeToken);
        var restoClient = AuthClient("restauranttunisia", _restoToken);

        var catId  = await CreateCategoryAsync(cafeClient, $"Cross Item Cat {Guid.NewGuid():N}");
        var itemId = await CreateItemAsync(cafeClient, catId, $"Cross Item {Guid.NewGuid():N}");

        var resp = await restoClient.GetAsync($"/menu-items/{itemId}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "a menu item from another tenant must not be accessible via GET by ID");
    }

    // ── Public menu isolation ─────────────────────────────────────────────────

    [Fact]
    public async Task PublicMenu_OnlyShowsItemsFromRequestedTenant()
    {
        var cafeClient  = AuthClient("cafetunisia", _cafeToken);
        var restoClient = AuthClient("restauranttunisia", _restoToken);

        var cafeCatId  = await CreateCategoryAsync(cafeClient, $"Cafe Pub Cat {Guid.NewGuid():N}");
        var cafeItemId = await CreateItemAsync(cafeClient, cafeCatId, $"Cafe Pub Item {Guid.NewGuid():N}");

        var restoCatId  = await CreateCategoryAsync(restoClient, $"Resto Pub Cat {Guid.NewGuid():N}");
        var restoItemId = await CreateItemAsync(restoClient, restoCatId, $"Resto Pub Item {Guid.NewGuid():N}");

        // Fetch the public menu for cafetunisia
        var cafeMenuClient = _factory.CreateClient();
        cafeMenuClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        var cafeMenuResp = await cafeMenuClient.GetAsync("/menu");
        var cafeMenu = await cafeMenuResp.Content.ReadFromJsonAsync<JsonElement>();

        var allCafeItemIds = cafeMenu.GetProperty("categories")
            .EnumerateArray()
            .SelectMany(c => c.GetProperty("items").EnumerateArray())
            .Select(i => i.GetProperty("id").GetString())
            .ToList();

        allCafeItemIds.Should().NotContain(restoItemId.ToString(),
            "the public menu for cafetunisia must not include items from restauranttunisia");
    }
}
