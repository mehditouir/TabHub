using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Services;

namespace TabHub.API.API.Controllers;

[Route("tables")]
public class TablesController(AppDbContext db, AuditService audit, ICurrentActor actor)
    : TenantControllerBase
{
    // ── Public: resolve a QR token to table info (used by customer page) ─────

    [AllowAnonymous]
    [HttpGet("resolve")]
    public async Task<IActionResult> Resolve([FromQuery] Guid qrToken)
    {
        var table = await db.Tables.FirstOrDefaultAsync(t => t.QrToken == qrToken && t.IsActive);
        if (table is null) return NotFound(new { error = "Invalid or inactive QR code." });
        return Ok(new { tableId = table.Id, tableNumber = table.Number });
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid? spaceId)
    {
        var query = db.Tables.AsQueryable();
        if (spaceId.HasValue) query = query.Where(t => t.SpaceId == spaceId.Value);
        return Ok(await query.Select(t => ToDto(t)).ToListAsync());
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var table = await db.Tables.FindAsync(id);
        return table is null ? NotFound() : Ok(ToDto(table));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTableRequest req)
    {
        var spaceExists = await db.Spaces.AnyAsync(s => s.Id == req.SpaceId);
        if (!spaceExists) return BadRequest(new { error = "Space not found." });

        var table = new RestaurantTable
        {
            SpaceId = req.SpaceId,
            Number  = req.Number,
            Col     = req.Col,
            Row     = req.Row,
        };

        db.Tables.Add(table);
        await db.SaveChangesAsync();
        await audit.LogAsync("create", nameof(RestaurantTable), table.Id.ToString(), actor, after: table);

        return Created($"/tables/{table.Id}", ToDto(table));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTableRequest req)
    {
        var table = await db.Tables.FindAsync(id);
        if (table is null) return NotFound();

        var before = Snapshot(table);
        table.Number    = req.Number;
        table.Col       = req.Col;
        table.Row       = req.Row;
        table.IsActive  = req.IsActive;
        table.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("update", nameof(RestaurantTable), table.Id.ToString(), actor, before, Snapshot(table));

        return Ok(ToDto(table));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var table = await db.Tables.FindAsync(id);
        if (table is null) return NotFound();

        table.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await audit.LogAsync("delete", nameof(RestaurantTable), table.Id.ToString(), actor, before: Snapshot(table));

        return NoContent();
    }

    private static TableDto ToDto(RestaurantTable t) =>
        new(t.Id, t.SpaceId, t.Number, t.Col, t.Row, t.QrToken, t.IsActive);

    private static object Snapshot(RestaurantTable t) =>
        new { t.Number, t.Col, t.Row, t.IsActive };
}
