using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace TabHub.Tests.Integration.Tables;

public class TableIntegrityTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebAppFactory _factory;
    private string _spaceId = null!;

    public TableIntegrityTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAsync()
    {
        var email = $"tableint_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Table Integrity Tester" });
        var loginResp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", loginBody.GetProperty("accessToken").GetString()!);

        var spaceResp = await _client.PostAsJsonAsync("/spaces",
            new { name = "Table Integrity Space", cols = 5, rows = 5, sortOrder = 0 });
        var spaceBody = await spaceResp.Content.ReadFromJsonAsync<JsonElement>();
        _spaceId = spaceBody.GetProperty("id").GetString()!;
    }

    private async Task<(Guid id, string qrToken)> CreateTableAsync(string number)
    {
        var resp = await _client.PostAsJsonAsync("/tables",
            new { spaceId = _spaceId, number, col = 1, row = 1 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return (Guid.Parse(body.GetProperty("id").GetString()!),
                body.GetProperty("qrToken").GetString()!);
    }

    // ── Soft delete ───────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteTable_RowStillExistsInDbWithDeletedAt()
    {
        var (id, _) = await CreateTableAsync("T-SoftDel");

        await _client.DeleteAsync($"/tables/{id}");

        var table = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.Tables
              .IgnoreQueryFilters()
              .FirstOrDefaultAsync(t => t.Id == id));

        table.Should().NotBeNull("row must still exist after soft delete");
        table!.DeletedAt.Should().NotBeNull("deleted_at must be set");
    }

    [Fact]
    public async Task DeleteTable_DeletedRowNotReturnedByGet()
    {
        var (id, _) = await CreateTableAsync("T-Ghost");
        await _client.DeleteAsync($"/tables/{id}");

        var resp = await _client.GetAsync($"/tables/{id}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteTable_DeletedRowNotReturnedByList()
    {
        var (id, _) = await CreateTableAsync("T-Hidden");
        await _client.DeleteAsync($"/tables/{id}");

        var listResp = await _client.GetAsync("/tables");
        var body = await listResp.Content.ReadFromJsonAsync<JsonElement>();
        var ids = body.EnumerateArray().Select(t => t.GetProperty("id").GetString()).ToList();

        ids.Should().NotContain(id.ToString());
    }

    // ── QR token stability ────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateTable_QrTokenDoesNotChange()
    {
        var (id, originalQr) = await CreateTableAsync("T-QR");

        await _client.PutAsJsonAsync($"/tables/{id}",
            new { number = "T-QR-Updated", col = 2, row = 3, isActive = true });

        var resp = await _client.GetAsync($"/tables/{id}");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var updatedQr = body.GetProperty("qrToken").GetString();

        updatedQr.Should().Be(originalQr, "QR token must never change once assigned");
    }

    // ── Audit logs ────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateTable_AuditLogIsWritten()
    {
        var (id, _) = await CreateTableAsync("T-AuditCreate");

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "RestaurantTable" &&
                a.EntityId == id.ToString() &&
                a.Action == "create"));

        log.Should().NotBeNull("a create audit log must be written");
    }

    [Fact]
    public async Task DeleteTable_AuditLogIsWritten()
    {
        var (id, _) = await CreateTableAsync("T-AuditDelete");
        await _client.DeleteAsync($"/tables/{id}");

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "RestaurantTable" &&
                a.EntityId == id.ToString() &&
                a.Action == "delete"));

        log.Should().NotBeNull("a delete audit log must be written");
    }
}
