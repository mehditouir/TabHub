using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.Infrastructure.Multitenancy;
using TabHub.API.Infrastructure.Persistence;

namespace TabHub.API.API.Controllers;

[ApiController]
[Route("[controller]")]
public class HealthController(AppDbContext db) : ControllerBase
{
    /// <summary>
    /// Returns the health of the API and the resolved tenant's database connection.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var tenant = HttpContext.Items[nameof(TenantContext)] as TenantContext;

        try
        {
            // Ping the DB — executes within the tenant schema thanks to TenantMiddleware
            await db.Database.ExecuteSqlRawAsync("SELECT 1");

            return Ok(new
            {
                status = "healthy",
                tenant = tenant?.Slug,
                schema = tenant?.SchemaName,
                timestamp = DateTime.UtcNow,
            });
        }
        catch (Exception ex)
        {
            return StatusCode(503, new
            {
                status = "unhealthy",
                tenant = tenant?.Slug,
                error = ex.Message,
            });
        }
    }
}
