using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace TabHub.Tests.Integration.Categories;

/// <summary>
/// Soft delete integrity and audit log tests for categories.
/// </summary>
public class CategoryIntegrityTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebAppFactory _factory;

    public CategoryIntegrityTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAuthAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAuthAsync()
    {
        var email = $"catint_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Category Integrity" });
        var resp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", body.GetProperty("accessToken").GetString()!);
    }

    private async Task<Guid> CreateCategoryAsync(string name = "Integrity Cat")
    {
        var resp = await _client.PostAsJsonAsync("/categories", new { name, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return Guid.Parse(body.GetProperty("id").GetString()!);
    }

    // ── Soft delete ───────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteCategory_RowStillExistsInDbWithDeletedAt()
    {
        var id = await CreateCategoryAsync("Soft Delete Cat");
        await _client.DeleteAsync($"/categories/{id}");

        var category = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.Categories.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == id));

        category.Should().NotBeNull("row must still exist after soft delete");
        category!.DeletedAt.Should().NotBeNull("deleted_at must be set");
    }

    [Fact]
    public async Task DeleteCategory_DeletedRowNotReturnedByGet()
    {
        var id = await CreateCategoryAsync("Ghost Cat");
        await _client.DeleteAsync($"/categories/{id}");

        var resp = await _client.GetAsync($"/categories/{id}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteCategory_DeletedRowNotReturnedByList()
    {
        var id = await CreateCategoryAsync("Hidden Cat");
        await _client.DeleteAsync($"/categories/{id}");

        var listResp = await _client.GetAsync("/categories");
        var body = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = body.EnumerateArray().Select(c => c.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(id.ToString());
    }

    // ── Audit logs ────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateCategory_AuditLogIsWritten()
    {
        var name = $"Audit Create Cat {Guid.NewGuid():N}";
        var resp = await _client.PostAsJsonAsync("/categories", new { name, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var id   = body.GetProperty("id").GetString()!;

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Category" && a.EntityId == id && a.Action == "create"));

        log.Should().NotBeNull("a create audit log must be written");
        log!.AfterState.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateCategory_AuditLogIsWritten()
    {
        var id = await CreateCategoryAsync("Audit Update Cat");

        await _client.PutAsJsonAsync($"/categories/{id}",
            new { name = "Updated Cat", sortOrder = 1, isActive = true });

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Category" && a.EntityId == id.ToString() && a.Action == "update"));

        log.Should().NotBeNull("an update audit log must be written");
        log!.BeforeState.Should().NotBeNull();
        log.AfterState.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteCategory_AuditLogIsWritten()
    {
        var id = await CreateCategoryAsync("Audit Delete Cat");
        await _client.DeleteAsync($"/categories/{id}");

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Category" && a.EntityId == id.ToString() && a.Action == "delete"));

        log.Should().NotBeNull("a delete audit log must be written");
        log!.BeforeState.Should().NotBeNull();
    }
}
