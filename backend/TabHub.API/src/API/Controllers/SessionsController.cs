using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Multitenancy;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Services;

namespace TabHub.API.API.Controllers;

[ApiController]
[Authorize]
[Route("sessions")]
public class SessionsController(AppDbContext db, AuditService audit, ICurrentActor actor) : ControllerBase
{
    private TenantContext? TenantCtx => HttpContext.Items[nameof(TenantContext)] as TenantContext;

    // ── Open a session for a table ────────────────────────────────────────────

    [HttpPost]
    public async Task<IActionResult> Open([FromBody] OpenSessionRequest req)
    {
        var table = await db.Tables.FirstOrDefaultAsync(t => t.Id == req.TableId && t.IsActive);
        if (table is null)
            return NotFound(new { error = "Table not found or inactive." });

        var existing = await db.TableSessions
            .FirstOrDefaultAsync(s => s.TableId == req.TableId && s.ClosedAt == null);
        if (existing is not null)
            return Conflict(new { error = "Table already has an open session.", sessionId = existing.Id });

        var staffId = actor.ActorType == "staff" && actor.ActorId is not null
            ? Guid.Parse(actor.ActorId) : (Guid?)null;

        var session = new TableSession
        {
            TableId = req.TableId,
            StaffId = staffId,
            Notes   = req.Notes,
        };

        db.TableSessions.Add(session);
        await db.SaveChangesAsync();
        await audit.LogAsync("open", nameof(TableSession), session.Id.ToString(), actor,
            after: new { session.TableId, session.StaffId });

        return Created($"/sessions/{session.Id}", await LoadDtoAsync(session.Id));
    }

    // ── List sessions ─────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid? tableId, [FromQuery] bool? open)
    {
        var query = db.TableSessions
            .Include(s => s.Table)
            .Include(s => s.Staff)
            .AsQueryable();

        if (tableId.HasValue)
            query = query.Where(s => s.TableId == tableId.Value);

        if (open == true)
            query = query.Where(s => s.ClosedAt == null);
        else if (open == false)
            query = query.Where(s => s.ClosedAt != null);

        var sessions = await query.OrderByDescending(s => s.OpenedAt).ToListAsync();

        var sessionIds   = sessions.Select(s => s.Id).ToList();
        var orderCounts  = await db.Orders
            .Where(o => o.SessionId.HasValue && sessionIds.Contains(o.SessionId.Value))
            .GroupBy(o => o.SessionId!.Value)
            .Select(g => new { SessionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SessionId, x => x.Count);

        return Ok(sessions.Select(s => MapToDto(s, orderCounts.GetValueOrDefault(s.Id, 0))));
    }

    // ── Get single session ────────────────────────────────────────────────────

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var session = await db.TableSessions
            .Include(s => s.Table)
            .Include(s => s.Staff)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (session is null) return NotFound();

        var orderCount = await db.Orders.CountAsync(o => o.SessionId == id);
        return Ok(MapToDto(session, orderCount));
    }

    // ── Close session ─────────────────────────────────────────────────────────

    [HttpPut("{id:guid}/close")]
    public async Task<IActionResult> Close(Guid id)
    {
        var session = await db.TableSessions
            .Include(s => s.Table)
            .Include(s => s.Staff)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (session is null) return NotFound();
        if (session.ClosedAt is not null)
            return Conflict(new { error = "Session is already closed." });

        var before    = new { session.ClosedAt };
        session.ClosedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("close", nameof(TableSession), session.Id.ToString(), actor,
            before, after: new { session.ClosedAt });

        var orderCount = await db.Orders.CountAsync(o => o.SessionId == id);
        return Ok(MapToDto(session, orderCount));
    }

    // ── Move session to another table ─────────────────────────────────────────

    [HttpPut("{id:guid}/move")]
    public async Task<IActionResult> Move(Guid id, [FromBody] MoveSessionRequest req)
    {
        var session = await db.TableSessions
            .Include(s => s.Table)
            .Include(s => s.Staff)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (session is null) return NotFound();
        if (session.ClosedAt is not null)
            return Conflict(new { error = "Cannot move a closed session." });

        var newTable = await db.Tables.FirstOrDefaultAsync(t => t.Id == req.NewTableId && t.IsActive);
        if (newTable is null)
            return NotFound(new { error = "Target table not found or inactive." });

        var conflict = await db.TableSessions
            .FirstOrDefaultAsync(s => s.TableId == req.NewTableId && s.ClosedAt == null && s.Id != id);
        if (conflict is not null)
            return Conflict(new { error = "Target table already has an open session." });

        var before     = new { session.TableId };
        session.TableId = req.NewTableId;
        session.Table   = newTable;

        await db.SaveChangesAsync();
        await audit.LogAsync("move", nameof(TableSession), session.Id.ToString(), actor,
            before, after: new { session.TableId });

        var orderCount = await db.Orders.CountAsync(o => o.SessionId == id);
        return Ok(MapToDto(session, orderCount));
    }

    // ── Merge source session into this session ────────────────────────────────

    [HttpPut("{id:guid}/merge")]
    public async Task<IActionResult> Merge(Guid id, [FromBody] MergeSessionRequest req)
    {
        if (id == req.SourceSessionId)
            return BadRequest(new { error = "Cannot merge a session with itself." });

        var target = await db.TableSessions
            .Include(s => s.Table)
            .Include(s => s.Staff)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (target is null) return NotFound(new { error = "Target session not found." });
        if (target.ClosedAt is not null)
            return Conflict(new { error = "Target session is closed." });

        var source = await db.TableSessions
            .FirstOrDefaultAsync(s => s.Id == req.SourceSessionId);
        if (source is null) return NotFound(new { error = "Source session not found." });
        if (source.ClosedAt is not null)
            return Conflict(new { error = "Source session is already closed." });

        var sourceOrders = await db.Orders
            .Where(o => o.SessionId == req.SourceSessionId)
            .ToListAsync();
        foreach (var order in sourceOrders)
            order.SessionId = id;

        source.ClosedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("merge", nameof(TableSession), id.ToString(), actor,
            after: new { TargetSessionId = id, SourceSessionId = req.SourceSessionId, OrdersMerged = sourceOrders.Count });

        var orderCount = await db.Orders.CountAsync(o => o.SessionId == id);
        return Ok(MapToDto(target, orderCount));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<SessionDto> LoadDtoAsync(Guid id)
    {
        var session = await db.TableSessions
            .Include(s => s.Table)
            .Include(s => s.Staff)
            .FirstAsync(s => s.Id == id);
        var orderCount = await db.Orders.CountAsync(o => o.SessionId == id);
        return MapToDto(session, orderCount);
    }

    private static SessionDto MapToDto(TableSession s, int orderCount) => new(
        s.Id,
        s.TableId,
        s.Table.Number,
        s.StaffId,
        s.Staff?.DisplayName,
        s.ClosedAt == null,
        s.OpenedAt,
        s.ClosedAt,
        s.Notes,
        orderCount);
}
