using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using TabHub.API.Infrastructure.Multitenancy;

namespace TabHub.API.API.Filters;

/// <summary>
/// Validates that the tenant_id in the JWT matches the tenant resolved by TenantMiddleware.
/// Prevents a token issued for tenant A from being used against tenant B's endpoints.
/// </summary>
public class TenantAuthorizationFilter : IAsyncAuthorizationFilter
{
    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // Skip for unauthenticated requests ([AllowAnonymous] endpoints)
        if (context.HttpContext.User.Identity?.IsAuthenticated != true)
            return Task.CompletedTask;

        var jwtTenantId = context.HttpContext.User.FindFirst("tenant_id")?.Value;
        var tenantCtx   = context.HttpContext.Items[nameof(TenantContext)] as TenantContext;

        if (jwtTenantId is null || tenantCtx is null) return Task.CompletedTask;

        if (!Guid.TryParse(jwtTenantId, out var tokenTenantId) || tokenTenantId != tenantCtx.TenantId)
            context.Result = new ForbidResult();

        return Task.CompletedTask;
    }
}
