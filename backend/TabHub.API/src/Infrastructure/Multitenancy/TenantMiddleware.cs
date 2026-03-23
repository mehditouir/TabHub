using Microsoft.EntityFrameworkCore;
using TabHub.API.Infrastructure.Persistence;

namespace TabHub.API.Infrastructure.Multitenancy;

public class TenantMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, AppDbContext db, TenantCache cache)
    {
        // Health endpoint must be reachable without a tenant (used by deployment verification)
        if (context.Request.Path.StartsWithSegments("/health"))
        {
            await next(context);
            return;
        }

        // X-Tenant header takes priority (for Swagger UI / local dev)
        // Falls back to X-Tenant query param (SignalR WebSocket — browsers can't set custom headers)
        // Falls back to subdomain extraction from Host header in production
        var xTenant = context.Request.Headers["X-Tenant"].FirstOrDefault()
                      ?? context.Request.Query["X-Tenant"].FirstOrDefault();
        var slug = xTenant ?? ExtractSlug(context.Request.Host.Host);

        if (slug is null)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new { error = "Unable to resolve tenant from host header." });
            return;
        }

        var tenantCtx = cache.Get(slug);

        if (tenantCtx is null)
        {
            var tenant = await db.Tenants
                .Where(t => t.Slug == slug && t.Status == Domain.Enums.TenantStatus.Active)
                .Select(t => new { t.Id, t.Slug, t.SchemaName })
                .FirstOrDefaultAsync();

            if (tenant is null)
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                await context.Response.WriteAsJsonAsync(new { error = $"Unknown tenant: '{slug}'." });
                return;
            }

            tenantCtx = new TenantContext
            {
                TenantId = tenant.Id,
                Slug = tenant.Slug,
                SchemaName = tenant.SchemaName,
            };

            cache.Set(slug, tenantCtx);
        }

        context.Items[nameof(TenantContext)] = tenantCtx;

        // Open the connection explicitly so it stays open for the whole request.
        // This ensures the SET search_path below is on the same connection that
        // EF Core will use for all subsequent queries in this request scope.
        await db.Database.OpenConnectionAsync();
        await db.SetSearchPathAsync(tenantCtx.SchemaName);

        await next(context);
    }

    private static string? ExtractSlug(string host)
    {
        // Supports: cafejasmine.tabhub.tn  OR  cafejasmine.localhost
        var parts = host.Split('.');
        return parts.Length >= 2 ? parts[0] : null;
    }
}
