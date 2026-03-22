using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace TabHub.Tests.Integration.Spaces;

/// <summary>
/// Tests for soft delete integrity and audit log side-effects on spaces.
/// </summary>
public class SpaceIntegrityTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebAppFactory _factory;

    public SpaceIntegrityTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAuthAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAuthAsync()
    {
        var email = $"spaceint_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Space Integrity Tester" });
        var resp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", body.GetProperty("accessToken").GetString()!);
    }

    private async Task<Guid> CreateSpaceAsync(string name = "Integrity Hall")
    {
        var resp = await _client.PostAsJsonAsync("/spaces",
            new { name, cols = 4, rows = 4, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return Guid.Parse(body.GetProperty("id").GetString()!);
    }

    // ── Soft delete ───────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteSpace_RowStillExistsInDbWithDeletedAt()
    {
        var id = await CreateSpaceAsync("Soft Delete Hall");

        await _client.DeleteAsync($"/spaces/{id}");

        // Query the DB directly, bypassing the soft-delete filter
        var space = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.Spaces
              .IgnoreQueryFilters()
              .FirstOrDefaultAsync(s => s.Id == id));

        space.Should().NotBeNull("row must still exist after soft delete");
        space!.DeletedAt.Should().NotBeNull("deleted_at must be set");
    }

    [Fact]
    public async Task DeleteSpace_DeletedRowNotReturnedByGet()
    {
        var id = await CreateSpaceAsync("Ghost Hall");
        await _client.DeleteAsync($"/spaces/{id}");

        var resp = await _client.GetAsync($"/spaces/{id}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteSpace_DeletedRowNotReturnedByList()
    {
        var id = await CreateSpaceAsync("Hidden Hall");
        await _client.DeleteAsync($"/spaces/{id}");

        var listResp = await _client.GetAsync("/spaces");
        var body = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = body.EnumerateArray().Select(s => s.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(id.ToString());
    }

    // ── Audit logs ────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateSpace_AuditLogIsWritten()
    {
        var name = $"Audit Create {Guid.NewGuid():N}";
        var resp = await _client.PostAsJsonAsync("/spaces",
            new { name, cols = 3, rows = 3, sortOrder = 0 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var id = body.GetProperty("id").GetString()!;

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Space" &&
                a.EntityId == id &&
                a.Action == "create"));

        log.Should().NotBeNull("a create audit log must be written");
        log!.AfterState.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateSpace_AuditLogIsWritten()
    {
        var id = await CreateSpaceAsync("Audit Update Hall");

        await _client.PutAsJsonAsync($"/spaces/{id}",
            new { name = "Updated", cols = 5, rows = 5, sortOrder = 1, isActive = true });

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Space" &&
                a.EntityId == id.ToString() &&
                a.Action == "update"));

        log.Should().NotBeNull("an update audit log must be written");
        log!.BeforeState.Should().NotBeNull("before state must be captured");
        log.AfterState.Should().NotBeNull("after state must be captured");
    }

    [Fact]
    public async Task DeleteSpace_AuditLogIsWritten()
    {
        var id = await CreateSpaceAsync("Audit Delete Hall");

        await _client.DeleteAsync($"/spaces/{id}");

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Space" &&
                a.EntityId == id.ToString() &&
                a.Action == "delete"));

        log.Should().NotBeNull("a delete audit log must be written");
        log!.BeforeState.Should().NotBeNull("before state must be captured on delete");
    }
}
