using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace TabHub.Tests.Integration.MenuItems;

/// <summary>
/// Soft delete integrity and audit log tests for menu items.
/// </summary>
public class MenuItemIntegrityTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebAppFactory _factory;
    private Guid _categoryId;

    public MenuItemIntegrityTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAsync()
    {
        var email = $"itemint_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Item Integrity" });
        var resp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", body.GetProperty("accessToken").GetString()!);

        var catResp = await _client.PostAsJsonAsync("/categories", new { name = "Integrity Cat", sortOrder = 0 });
        var catBody = await catResp.Content.ReadFromJsonAsync<JsonElement>();
        _categoryId = Guid.Parse(catBody.GetProperty("id").GetString()!);
    }

    private async Task<Guid> CreateItemAsync(string name = "Test Item")
    {
        var resp = await _client.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name, price = 5.0m, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return Guid.Parse(body.GetProperty("id").GetString()!);
    }

    // ── Soft delete ───────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteMenuItem_RowStillExistsInDbWithDeletedAt()
    {
        var id = await CreateItemAsync("Soft Delete Item");
        await _client.DeleteAsync($"/menu-items/{id}");

        var item = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.MenuItems.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Id == id));

        item.Should().NotBeNull("row must still exist after soft delete");
        item!.DeletedAt.Should().NotBeNull("deleted_at must be set");
    }

    [Fact]
    public async Task DeleteMenuItem_DeletedRowNotReturnedByGet()
    {
        var id = await CreateItemAsync("Ghost Item");
        await _client.DeleteAsync($"/menu-items/{id}");

        var resp = await _client.GetAsync($"/menu-items/{id}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteMenuItem_DeletedRowNotReturnedByList()
    {
        var id = await CreateItemAsync("Hidden Item");
        await _client.DeleteAsync($"/menu-items/{id}");

        var listResp = await _client.GetAsync("/menu-items");
        var body = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = body.EnumerateArray().Select(i => i.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(id.ToString());
    }

    // ── Audit logs ────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateMenuItem_AuditLogIsWritten()
    {
        var name = $"Audit Create Item {Guid.NewGuid():N}";
        var resp = await _client.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name, price = 5.0m, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var id   = body.GetProperty("id").GetString()!;

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "MenuItem" && a.EntityId == id && a.Action == "create"));

        log.Should().NotBeNull("a create audit log must be written");
        log!.AfterState.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateMenuItem_AuditLogIsWritten()
    {
        var id = await CreateItemAsync("Audit Update Item");

        await _client.PutAsJsonAsync($"/menu-items/{id}", new
        {
            categoryId  = _categoryId,
            name        = "Updated Item",
            price       = 6.0m,
            isAvailable = true,
            sortOrder   = 1,
        });

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "MenuItem" && a.EntityId == id.ToString() && a.Action == "update"));

        log.Should().NotBeNull("an update audit log must be written");
        log!.BeforeState.Should().NotBeNull();
        log.AfterState.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteMenuItem_AuditLogIsWritten()
    {
        var id = await CreateItemAsync("Audit Delete Item");
        await _client.DeleteAsync($"/menu-items/{id}");

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "MenuItem" && a.EntityId == id.ToString() && a.Action == "delete"));

        log.Should().NotBeNull("a delete audit log must be written");
        log!.BeforeState.Should().NotBeNull();
    }

    // ── Price precision ───────────────────────────────────────────────────────

    [Fact]
    public async Task CreateMenuItem_PriceWith3DecimalPlaces_StoredCorrectly()
    {
        var resp = await _client.PostAsJsonAsync("/menu-items",
            new { categoryId = _categoryId, name = "Precise Item", price = 12.750m, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var id = body.GetProperty("id").GetString()!;

        var item = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.MenuItems.FirstOrDefaultAsync(i => i.Id == Guid.Parse(id)));

        item.Should().NotBeNull();
        item!.Price.Should().Be(12.750m);
    }
}
