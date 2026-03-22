using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.Config;

public class ConfigTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebAppFactory _factory;

    public ConfigTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");
        SetupAuthAsync().GetAwaiter().GetResult();
    }

    private async Task SetupAuthAsync()
    {
        var email = $"config_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Config Tester" });
        var resp = await _client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization =
            new("Bearer", body.GetProperty("accessToken").GetString()!);
    }

    // ── Set (upsert) ──────────────────────────────────────────────────────────

    [Fact]
    public async Task SetConfig_NewKey_Returns200()
    {
        var key = $"key_{Guid.NewGuid():N}";

        var resp = await _client.PutAsJsonAsync($"/config/{key}", new { value = "hello" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("key").GetString().Should().Be(key);
        body.GetProperty("value").GetString().Should().Be("hello");
    }

    [Fact]
    public async Task SetConfig_ExistingKey_OverwritesValue()
    {
        var key = $"key_{Guid.NewGuid():N}";
        await _client.PutAsJsonAsync($"/config/{key}", new { value = "first" });

        var resp = await _client.PutAsJsonAsync($"/config/{key}", new { value = "second" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("value").GetString().Should().Be("second");
    }

    // ── Get all ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllConfigs_Returns200WithSetKeys()
    {
        var key = $"key_{Guid.NewGuid():N}";
        await _client.PutAsJsonAsync($"/config/{key}", new { value = "test-value" });

        var resp = await _client.GetAsync("/config");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.TryGetProperty(key, out var val).Should().BeTrue();
        val.GetString().Should().Be("test-value");
    }

    // ── Get by key ────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetConfig_ExistingKey_Returns200()
    {
        var key = $"key_{Guid.NewGuid():N}";
        await _client.PutAsJsonAsync($"/config/{key}", new { value = "findme" });

        var resp = await _client.GetAsync($"/config/{key}");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("value").GetString().Should().Be("findme");
    }

    [Fact]
    public async Task GetConfig_UnknownKey_Returns404()
    {
        var resp = await _client.GetAsync($"/config/nonexistent_key_{Guid.NewGuid():N}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Auth guard ────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllConfigs_NoToken_Returns401()
    {
        var unauthClient = _factory.CreateClient();
        unauthClient.DefaultRequestHeaders.Add("X-Tenant", "cafetunisia");

        var resp = await unauthClient.GetAsync("/config");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
