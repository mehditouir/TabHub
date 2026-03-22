using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.Auth;

public class AuthAdvancedTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private HttpClient TenantClient(string tenant = "cafetunisia")
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Tenant", tenant);
        return client;
    }

    private static string UniqueEmail() => $"adv_{Guid.NewGuid():N}@test.com";

    private async Task<(string email, string accessToken, string setCookieHeader)> RegisterAndLoginAsync(
        string tenant = "cafetunisia")
    {
        var client = TenantClient(tenant);
        var email = UniqueEmail();
        await client.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Adv Tester" });
        var resp = await client.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("accessToken").GetString()!;
        var cookie = resp.Headers.GetValues("Set-Cookie").First().Split(';')[0];
        return (email, token, cookie);
    }

    // ── JWT claims ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Login_AccessToken_ContainsCorrectClaims()
    {
        var (email, token, _) = await RegisterAndLoginAsync();

        var payload = DecodeJwtPayload(token);

        payload.GetProperty("actor_type").GetString().Should().Be("manager");
        payload.GetProperty("email").GetString().Should().Be(email);
        payload.TryGetProperty("tenant_id", out _).Should().BeTrue("JWT must carry tenant_id");
        payload.TryGetProperty("sub", out _).Should().BeTrue("JWT must carry sub (manager id)");
        payload.TryGetProperty("role", out _).Should().BeTrue("JWT must carry role");
    }

    [Fact]
    public async Task StaffLogin_AccessToken_ContainsCorrectClaims()
    {
        // Create a staff member first
        var (_, managerToken, _) = await RegisterAndLoginAsync();
        var mgr = TenantClient();
        mgr.DefaultRequestHeaders.Authorization = new("Bearer", managerToken);
        var pin = Guid.NewGuid().ToString("N")[..6];
        await mgr.PostAsJsonAsync("/staff", new { displayName = "JWT Staff", role = "Waiter", pin });

        var staffClient = TenantClient();
        var resp = await staffClient.PostAsJsonAsync("/auth/staff/pin-login", new { pin });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("accessToken").GetString()!;

        var payload = DecodeJwtPayload(token);

        payload.GetProperty("actor_type").GetString().Should().Be("staff");
        payload.TryGetProperty("tenant_id", out _).Should().BeTrue();
        payload.TryGetProperty("sub", out _).Should().BeTrue();
    }

    // ── Token rotation ────────────────────────────────────────────────────────

    [Fact]
    public async Task Refresh_AfterRotation_OldTokenReturns401()
    {
        var (_, _, cookie) = await RegisterAndLoginAsync();
        var client = TenantClient();

        // Use the refresh token once — rotates it
        var firstReq = new HttpRequestMessage(HttpMethod.Post, "/auth/refresh");
        firstReq.Headers.Add("Cookie", cookie);
        var firstResp = await client.SendAsync(firstReq);
        firstResp.StatusCode.Should().Be(HttpStatusCode.OK);

        // Try the SAME (now revoked) refresh token again
        var secondReq = new HttpRequestMessage(HttpMethod.Post, "/auth/refresh");
        secondReq.Headers.Add("Cookie", cookie);
        var secondResp = await client.SendAsync(secondReq);

        secondResp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_NewCookieWorks_AfterRotation()
    {
        var (_, _, oldCookie) = await RegisterAndLoginAsync();
        var client = TenantClient();

        // Use old token → get new token + new cookie
        var req = new HttpRequestMessage(HttpMethod.Post, "/auth/refresh");
        req.Headers.Add("Cookie", oldCookie);
        var resp = await client.SendAsync(req);
        var newCookie = resp.Headers.GetValues("Set-Cookie").First().Split(';')[0];

        // Use the NEW cookie → should work
        var req2 = new HttpRequestMessage(HttpMethod.Post, "/auth/refresh");
        req2.Headers.Add("Cookie", newCookie);
        var resp2 = await client.SendAsync(req2);

        resp2.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── Cross-tenant token rejection ──────────────────────────────────────────

    [Fact]
    public async Task Token_FromCafetunisia_RejectedByRestauranttunisia_Returns403()
    {
        var (_, cafeToken, _) = await RegisterAndLoginAsync("cafetunisia");

        // Use cafetunisia token but point at restauranttunisia
        var crossClient = TenantClient("restauranttunisia");
        crossClient.DefaultRequestHeaders.Authorization = new("Bearer", cafeToken);

        var resp = await crossClient.GetAsync("/spaces");

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Token_FromRestauranttunisia_RejectedByCafetunisia_Returns403()
    {
        var (_, restoToken, _) = await RegisterAndLoginAsync("restauranttunisia");

        var crossClient = TenantClient("cafetunisia");
        crossClient.DefaultRequestHeaders.Authorization = new("Bearer", restoToken);

        var resp = await crossClient.GetAsync("/spaces");

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Manager registered in wrong tenant is rejected ────────────────────────

    [Fact]
    public async Task Login_Manager_NotInTenant_Returns403()
    {
        // Register in cafetunisia
        var email = UniqueEmail();
        var cafeClient = TenantClient("cafetunisia");
        await cafeClient.PostAsJsonAsync("/auth/register",
            new { email, password = "Test123!", displayName = "Cafe Only" });

        // Try to log in via restauranttunisia (manager has no ManagerTenant row for it)
        var restoClient = TenantClient("restauranttunisia");
        var resp = await restoClient.PostAsJsonAsync("/auth/login",
            new { email, password = "Test123!" });

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static JsonElement DecodeJwtPayload(string token)
    {
        var payload = token.Split('.')[1];
        var padded = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
        var json = Encoding.UTF8.GetString(Convert.FromBase64String(padded));
        return JsonSerializer.Deserialize<JsonElement>(json);
    }
}
