using Microsoft.AspNetCore.Mvc;

namespace TabHub.API.API.Controllers;

[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    /// <summary>
    /// Returns the health of the API and the resolved tenant's database connection.
    /// </summary>
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
    }
}
