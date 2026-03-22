using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using TabHub.Tests.Integration;
using Xunit;

namespace TabHub.Tests.Integration.Auth;

public class AuthTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private HttpClient TenantClient(string tenant = "cafetunisia")
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", tenant);
        return client;
    }

    private static string UniqueEmail() => $"test_{Guid.NewGuid():N}@test.com";

    private async Task<(HttpClient client, JsonElement body)> RegisterAsync(
        string? email = null, string password = "Test123!", string displayName = "Test User")
    {
        var client = TenantClient();
        email ??= UniqueEmail();
        var resp = await client.PostAsJsonAsync("/auth/register",
            new { email, password, displayName });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return (client, body);
    }

    private async Task<(HttpClient client, string accessToken)> LoginAsync(
        string email, string password = "Test123!")
    {
        var client = TenantClient();
        var resp = await client.PostAsJsonAsync("/auth/login", new { email, password });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("accessToken").GetString()!;
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        return (client, token);
    }

    // ── Register ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Register_NewEmail_Returns201()
    {
        var (_, body) = await RegisterAsync();

        body.GetProperty("email").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Register_DuplicateEmail_Returns409()
    {
        var email = UniqueEmail();
        var client = TenantClient();
        await client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "First" });

        var resp = await client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Second" });

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Login_ValidCredentials_Returns200WithToken()
    {
        var email = UniqueEmail();
        var client = TenantClient();
        await client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Test" });

        var resp = await client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("accessToken").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("role").GetString().Should().BeOneOf("owner", "admin");
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var email = UniqueEmail();
        var client = TenantClient();
        await client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Test" });

        var resp = await client.PostAsJsonAsync("/auth/login",
            new { email, password = "WrongPassword!" });

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_UnknownEmail_Returns401()
    {
        var client = TenantClient();
        var resp = await client.PostAsJsonAsync("/auth/login",
            new { email = "nobody@test.com", password = "Test123!" });

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Refresh ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Refresh_ValidCookie_Returns200WithNewToken()
    {
        var email = UniqueEmail();
        var client = TenantClient();

        await client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Test" });
        var loginResp = await client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        var firstToken = loginBody.GetProperty("accessToken").GetString()!;

        // Manually extract the refresh_token cookie from the login response
        var setCookie = loginResp.Headers.GetValues("Set-Cookie").FirstOrDefault();
        setCookie.Should().NotBeNullOrEmpty("login should set a refresh_token cookie");
        var cookieValue = setCookie!.Split(';')[0]; // e.g. "refresh_token=abc..."

        var refreshReq = new HttpRequestMessage(HttpMethod.Post, "/auth/refresh");
        refreshReq.Headers.Add("Cookie", cookieValue);
        var refreshResp = await client.SendAsync(refreshReq);
        var refreshBody = await refreshResp.Content.ReadFromJsonAsync<JsonElement>();

        refreshResp.StatusCode.Should().Be(HttpStatusCode.OK);
        refreshBody.GetProperty("accessToken").GetString().Should().NotBeNullOrEmpty();
        refreshBody.GetProperty("accessToken").GetString().Should().NotBe(firstToken);
    }

    [Fact]
    public async Task Refresh_NoCookie_Returns401()
    {
        var client = TenantClient();
        var resp = await client.PostAsync("/auth/refresh", null);

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Logout_AuthenticatedUser_Returns204()
    {
        var email = UniqueEmail();
        var client = TenantClient();
        await client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Test" });
        var loginResp = await client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Authorization =
            new("Bearer", body.GetProperty("accessToken").GetString()!);

        var resp = await client.PostAsync("/auth/logout", null);

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Logout_NoToken_Returns401()
    {
        var client = TenantClient();
        var resp = await client.PostAsync("/auth/logout", null);

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
