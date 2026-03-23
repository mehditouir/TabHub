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

        // Step 1: create public.tenants before the migration runs.
        // The migration adds a FK from manager_tenants → public.tenants, so the table
        // must exist first. managers/manager_tenants themselves are created by the migration.
        await using (var setupConn = new NpgsqlConnection(_postgres.GetConnectionString()))
        {
            await setupConn.OpenAsync();
            await using var cmd = new NpgsqlCommand("""
                CREATE TABLE IF NOT EXISTS public.tenants (
                    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
                    slug        VARCHAR(63)  NOT NULL UNIQUE,
                    schema_name VARCHAR(63)  NOT NULL UNIQUE,
                    name        VARCHAR(255) NOT NULL,
                    status      VARCHAR(20)  NOT NULL DEFAULT 'Active',
                    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
                )
                """, setupConn);
            await cmd.ExecuteNonQueryAsync();
        }

        // Step 2: accessing Services triggers EnsureServer → Program.cs startup →
        // db.Database.MigrateAsync() which creates managers, refresh_tokens, manager_tenants.
        _ = Services;

        // Step 3: seed the rest — tenant rows, manager account, tenant schemas.
        // db-init.sql uses CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING throughout.
        await SeedDatabaseAsync();
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
