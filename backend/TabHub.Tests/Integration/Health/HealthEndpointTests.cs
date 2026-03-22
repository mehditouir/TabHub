using System.Net;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace TabHub.Tests.Integration.Health;

public class HealthEndpointTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Health_CafeTunisia_ReturnsHealthy()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Host = "cafetunisia.localhost";

        var response = await _client.SendAsync(request);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("status").GetString().Should().Be("healthy");
        body.GetProperty("tenant").GetString().Should().Be("cafetunisia");
        body.GetProperty("schema").GetString().Should().Be("cafetunisia");
    }

    [Fact]
    public async Task Health_RestaurantTunisia_ReturnsHealthy()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Host = "restauranttunisia.localhost";

        var response = await _client.SendAsync(request);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("status").GetString().Should().Be("healthy");
        body.GetProperty("tenant").GetString().Should().Be("restauranttunisia");
        body.GetProperty("schema").GetString().Should().Be("restauranttunisia");
    }

    [Fact]
    public async Task Health_UnknownTenant_Returns404()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Host = "unknown.localhost";

        var response = await _client.SendAsync(request);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        body.GetProperty("error").GetString().Should().Contain("unknown");
    }
}
