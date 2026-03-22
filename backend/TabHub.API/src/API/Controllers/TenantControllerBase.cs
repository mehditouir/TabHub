using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TabHub.API.Infrastructure.Multitenancy;

namespace TabHub.API.API.Controllers;

[ApiController]
[Authorize]
public abstract class TenantControllerBase : ControllerBase
{
    protected TenantContext TenantCtx =>
        (HttpContext.Items[nameof(TenantContext)] as TenantContext)!;
}
