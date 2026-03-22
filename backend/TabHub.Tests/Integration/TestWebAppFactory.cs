using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TabHub.API.Infrastructure.Persistence;
using Testcontainers.PostgreSql;
using Xunit;

namespace TabHub.Tests.Integration;

/// <summary>
/// Spins up the real API in-memory against a throwaway PostgreSQL container.
/// Shared across all tests in a collection to avoid container overhead per test.
/// </summary>
public class TestWebAppFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:15-alpine")
        .WithDatabase("tabhub")
        .WithUsername("tabhub")
        .WithPassword("tabhub_test")
        .Build();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await SeedDatabaseAsync();
        // Apply EF migrations (creates managers, refresh_tokens, manager_tenants)
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Signal to Program.cs that we're in test mode (disables HTTPS redirect)
        builder.UseEnvironment("Testing");

        // Override the connection string to point at the throwaway container
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = _postgres.GetConnectionString()
            });
        });
    }

    private async Task SeedDatabaseAsync()
    {
        var sql = await File.ReadAllTextAsync("scripts/db-init.sql");

        // Split into individual statements to avoid multi-statement parsing issues.
        // Strip comment-only lines, then skip empty statements.
        var statements = sql
            .Split(';')
            .Select(s => string.Join('\n',
                s.Split('\n').Where(line => !line.TrimStart().StartsWith("--"))))
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s));

        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync();

        foreach (var stmt in statements)
        {
            await using var cmd = new NpgsqlCommand(stmt, conn);
            await cmd.ExecuteNonQueryAsync();
        }
    }

    /// <summary>
    /// Run a direct DB query against a specific tenant schema.
    /// Useful for asserting side-effects (audit logs, soft deletes, etc.) without going through HTTP.
    /// </summary>
    public async Task<T> QueryTenantAsync<T>(string schema, Func<AppDbContext, Task<T>> query)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.OpenConnectionAsync();
        await db.SetSearchPathAsync(schema);
        return await query(db);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await _postgres.DisposeAsync();
    }
}
