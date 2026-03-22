using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace TabHub.Tests.Integration.Staff;

public class StaffIntegrityTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebAppFactory _factory;

    public StaffIntegrityTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAuthAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAuthAsync()
    {
        var email = $"staffint_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Staff Integrity Tester" });
        var resp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", body.GetProperty("accessToken").GetString()!);
    }

    private static string UniquePin() => Guid.NewGuid().ToString("N")[..8];

    private async Task<Guid> CreateStaffAsync(string name, string pin)
    {
        var resp = await _client.PostAsJsonAsync("/staff",
            new { displayName = name, role = "Waiter", pin });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return Guid.Parse(body.GetProperty("id").GetString()!);
    }

    // ── Soft delete ───────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteStaff_RowStillExistsInDbWithDeletedAt()
    {
        var id = await CreateStaffAsync("Soft Del Staff", UniquePin());

        await _client.DeleteAsync($"/staff/{id}");

        var staff = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.Staff
              .IgnoreQueryFilters()
              .FirstOrDefaultAsync(s => s.Id == id));

        staff.Should().NotBeNull("row must still exist after soft delete");
        staff!.DeletedAt.Should().NotBeNull("deleted_at must be set");
    }

    [Fact]
    public async Task DeleteStaff_DeletedStaffCannotLoginWithPin()
    {
        var pin = UniquePin();
        var id = await CreateStaffAsync("Deleted Staff PinLogin", pin);
        await _client.DeleteAsync($"/staff/{id}");

        var unauthClient = _factory.CreateClient();
        unauthClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        var resp = await unauthClient.PostAsJsonAsync("/auth/staff/pin-login", new { pin });

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized,
            "deleted (inactive) staff must not be able to log in");
    }

    // ── PIN rotation ──────────────────────────────────────────────────────────

    [Fact]
    public async Task SetPin_OldPinNoLongerWorks()
    {
        var oldPin = UniquePin();
        var newPin = UniquePin();
        var id = await CreateStaffAsync("Pin Rotation Staff", oldPin);

        // Verify old PIN works before rotation
        var unauthClient = _factory.CreateClient();
        unauthClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        var beforeResp = await unauthClient.PostAsJsonAsync("/auth/staff/pin-login",
            new { pin = oldPin });
        beforeResp.StatusCode.Should().Be(HttpStatusCode.OK, "old PIN must work before rotation");

        // Rotate PIN
        await _client.PutAsJsonAsync($"/staff/{id}/pin", new { pin = newPin });

        // Old PIN should now fail
        var afterResp = await unauthClient.PostAsJsonAsync("/auth/staff/pin-login",
            new { pin = oldPin });
        afterResp.StatusCode.Should().Be(HttpStatusCode.Unauthorized,
            "old PIN must not work after rotation");
    }

    [Fact]
    public async Task SetPin_NewPinWorks()
    {
        var oldPin = UniquePin();
        var newPin = UniquePin();
        var id = await CreateStaffAsync("Pin Rotation Staff 2", oldPin);

        await _client.PutAsJsonAsync($"/staff/{id}/pin", new { pin = newPin });

        var unauthClient = _factory.CreateClient();
        unauthClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        var resp = await unauthClient.PostAsJsonAsync("/auth/staff/pin-login",
            new { pin = newPin });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK, "new PIN must work after rotation");
        body.GetProperty("accessToken").GetString().Should().NotBeNullOrEmpty();
    }

    // ── Audit logs ────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateStaff_AuditLogIsWritten()
    {
        var id = await CreateStaffAsync("Audit Staff", UniquePin());

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Staff" &&
                a.EntityId == id.ToString() &&
                a.Action == "create"));

        log.Should().NotBeNull("a create audit log must be written");
        log!.AfterState.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteStaff_AuditLogIsWritten()
    {
        var id = await CreateStaffAsync("Audit Delete Staff", UniquePin());
        await _client.DeleteAsync($"/staff/{id}");

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Staff" &&
                a.EntityId == id.ToString() &&
                a.Action == "delete"));

        log.Should().NotBeNull("a delete audit log must be written");
    }

    [Fact]
    public async Task SetPin_AuditLogIsWritten()
    {
        var id = await CreateStaffAsync("Pin Audit Staff", UniquePin());
        await _client.PutAsJsonAsync($"/staff/{id}/pin", new { pin = UniquePin() });

        var log = await _factory.QueryTenantAsync("cafetunisia", db =>
            db.AuditLogs.FirstOrDefaultAsync(a =>
                a.EntityType == "Staff" &&
                a.EntityId == id.ToString() &&
                a.Action == "update"));

        log.Should().NotBeNull("a pin update audit log must be written");
    }
}
