using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Services;

namespace TabHub.API.API.Controllers;

[Route("staff")]
public class StaffController(AppDbContext db, AuditService audit, ICurrentActor actor, PinHasher pins)
    : TenantControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.Staff.Select(s => ToDto(s)).ToListAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var s = await db.Staff.FindAsync(id);
        return s is null ? NotFound() : Ok(ToDto(s));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateStaffRequest req)
    {
        if (!Enum.TryParse<StaffRole>(req.Role, true, out var role))
            return BadRequest(new { error = "Invalid role. Use Waiter, Kitchen or Cashier." });

        var staff = new Staff
        {
            DisplayName = req.DisplayName,
            Role        = role,
            PinHash     = pins.Hash(req.Pin),
        };

        db.Staff.Add(staff);
        await db.SaveChangesAsync();
        await audit.LogAsync("create", nameof(Staff), staff.Id.ToString(), actor,
            after: new { staff.DisplayName, staff.Role });

        return Created($"/staff/{staff.Id}", ToDto(staff));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateStaffRequest req)
    {
        if (!Enum.TryParse<StaffRole>(req.Role, true, out var role))
            return BadRequest(new { error = "Invalid role." });

        var staff = await db.Staff.FindAsync(id);
        if (staff is null) return NotFound();

        var before = new { staff.DisplayName, staff.Role, staff.IsActive };
        staff.DisplayName = req.DisplayName;
        staff.Role        = role;
        staff.IsActive    = req.IsActive;
        staff.UpdatedAt   = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("update", nameof(Staff), staff.Id.ToString(), actor,
            before, after: new { staff.DisplayName, staff.Role, staff.IsActive });

        return Ok(ToDto(staff));
    }

    [HttpPut("{id:guid}/pin")]
    public async Task<IActionResult> SetPin(Guid id, [FromBody] SetPinRequest req)
    {
        var staff = await db.Staff.FindAsync(id);
        if (staff is null) return NotFound();

        staff.PinHash   = pins.Hash(req.Pin);
        staff.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("update", nameof(Staff), staff.Id.ToString(), actor,
            after: new { action = "pin_changed" });

        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var staff = await db.Staff.FindAsync(id);
        if (staff is null) return NotFound();

        staff.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await audit.LogAsync("delete", nameof(Staff), staff.Id.ToString(), actor,
            before: new { staff.DisplayName, staff.Role });

        return NoContent();
    }

    // ── Waiter zones ─────────────────────────────────────────────────────────

    [HttpGet("{id:guid}/zones")]
    public async Task<IActionResult> GetZones(Guid id) =>
        Ok(await db.WaiterZones
            .Where(z => z.StaffId == id)
            .Select(z => new WaiterZoneDto(z.Id, z.SpaceId, z.ColStart, z.ColEnd, z.RowStart, z.RowEnd))
            .ToListAsync());

    [HttpPost("{id:guid}/zones")]
    public async Task<IActionResult> AddZone(Guid id, [FromBody] CreateWaiterZoneRequest req)
    {
        var staffExists = await db.Staff.AnyAsync(s => s.Id == id);
        if (!staffExists) return NotFound(new { error = "Staff member not found." });

        var spaceExists = await db.Spaces.AnyAsync(s => s.Id == req.SpaceId);
        if (!spaceExists) return BadRequest(new { error = "Space not found." });

        if (req.ColStart > req.ColEnd)
            return BadRequest(new { error = "ColStart must be less than or equal to ColEnd." });
        if (req.RowStart > req.RowEnd)
            return BadRequest(new { error = "RowStart must be less than or equal to RowEnd." });

        var zone = new WaiterZone
        {
            StaffId  = id,
            SpaceId  = req.SpaceId,
            ColStart = req.ColStart,
            ColEnd   = req.ColEnd,
            RowStart = req.RowStart,
            RowEnd   = req.RowEnd,
        };

        db.WaiterZones.Add(zone);
        await db.SaveChangesAsync();

        return Created($"/staff/{id}/zones/{zone.Id}",
            new WaiterZoneDto(zone.Id, zone.SpaceId, zone.ColStart, zone.ColEnd, zone.RowStart, zone.RowEnd));
    }

    [HttpDelete("{id:guid}/zones/{zoneId:guid}")]
    public async Task<IActionResult> RemoveZone(Guid id, Guid zoneId)
    {
        var zone = await db.WaiterZones.FirstOrDefaultAsync(z => z.Id == zoneId && z.StaffId == id);
        if (zone is null) return NotFound();

        db.WaiterZones.Remove(zone);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static StaffDto ToDto(Staff s) => new(s.Id, s.DisplayName, s.Role.ToString(), s.IsActive);
}
