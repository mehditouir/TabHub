using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Persistence;

namespace TabHub.API.API.Controllers;

[ApiController]
[Authorize]
[Route("notifications")]
public class NotificationsController(AppDbContext db, ICurrentActor actor) : ControllerBase
{
    // ── List notifications (for current tenant) ───────────────────────────────

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool includeAcknowledged = false)
    {
        var query = db.Notifications
            .Include(n => n.Order).ThenInclude(o => o.Table)
            .Include(n => n.Order).ThenInclude(o => o.Items)
            .Include(n => n.AcknowledgedByStaff)
            .AsQueryable();

        if (!includeAcknowledged)
            query = query.Where(n => !n.IsAcknowledged);

        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        return Ok(notifications.Select(MapToDto));
    }

    // ── Get single notification ───────────────────────────────────────────────

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var notification = await db.Notifications
            .Include(n => n.Order).ThenInclude(o => o.Table)
            .Include(n => n.Order).ThenInclude(o => o.Items)
            .Include(n => n.AcknowledgedByStaff)
            .FirstOrDefaultAsync(n => n.Id == id);

        return notification is null ? NotFound() : Ok(MapToDto(notification));
    }

    // ── Acknowledge — competing consumer, first-writer-wins via row lock ──────

    [HttpPut("{id:guid}/ack")]
    public async Task<IActionResult> Acknowledge(Guid id)
    {
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        try
        {
            // Row-level lock: only one transaction can proceed at a time per notification
            var notification = await db.Notifications
                .FromSqlRaw("SELECT * FROM notifications WHERE id = {0} FOR UPDATE", id)
                .Include(n => n.Order).ThenInclude(o => o.Table)
                .Include(n => n.Order).ThenInclude(o => o.Items)
                .Include(n => n.AcknowledgedByStaff)
                .FirstOrDefaultAsync();

            if (notification is null)
            {
                await tx.RollbackAsync();
                return NotFound();
            }

            if (notification.IsAcknowledged)
            {
                await tx.RollbackAsync();
                return Conflict(new { error = "Notification already acknowledged.", acknowledgedAt = notification.AcknowledgedAt });
            }

            var staffId = actor.ActorType == "staff" && actor.ActorId is not null
                ? Guid.Parse(actor.ActorId) : (Guid?)null;

            notification.IsAcknowledged         = true;
            notification.AcknowledgedByStaffId  = staffId;
            notification.AcknowledgedAt         = DateTime.UtcNow;

            await db.SaveChangesAsync();
            await tx.CommitAsync();

            // Reload navigation properties after commit
            await db.Entry(notification).Reference(n => n.AcknowledgedByStaff).LoadAsync();

            return Ok(MapToDto(notification));
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private static NotificationDto MapToDto(Notification n) => new(
        n.Id,
        n.EventType,
        n.OrderId,
        n.TableId,
        n.IsAcknowledged,
        n.AcknowledgedByStaffId,
        n.AcknowledgedByStaff?.DisplayName,
        n.AcknowledgedAt,
        n.CreatedAt,
        OrdersController.MapOrderToDto(n.Order));
}
