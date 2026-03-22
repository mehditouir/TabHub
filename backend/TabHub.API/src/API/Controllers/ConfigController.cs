using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Services;

namespace TabHub.API.API.Controllers;

[Route("config")]
public class ConfigController(AppDbContext db, AuditService audit, ICurrentActor actor)
    : TenantControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.Configs.ToDictionaryAsync(c => c.Key, c => c.Value));

    [HttpGet("{key}")]
    public async Task<IActionResult> Get(string key)
    {
        var config = await db.Configs.FindAsync(key);
        return config is null ? NotFound() : Ok(new { config.Key, config.Value });
    }

    [HttpPut("{key}")]
    public async Task<IActionResult> Set(string key, [FromBody] SetConfigRequest req)
    {
        var config = await db.Configs.FindAsync(key);
        var before = config?.Value;

        if (config is null)
        {
            config = new Config { Key = key, Value = req.Value };
            db.Configs.Add(config);
        }
        else
        {
            config.Value     = req.Value;
            config.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        await audit.LogAsync("upsert", nameof(Config), key, actor,
            before: before is null ? null : new { key, value = before },
            after:  new { key, value = req.Value });

        return Ok(new { config.Key, config.Value });
    }
}
