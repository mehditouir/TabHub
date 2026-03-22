using System.Text.Json;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Persistence;

namespace TabHub.API.Infrastructure.Services;

public class AuditService(AppDbContext db)
{
    public async Task LogAsync<T>(
        string action,
        string entityType,
        string entityId,
        ICurrentActor actor,
        T? before = default,
        T? after  = default)
    {
        var log = new AuditLog
        {
            Action       = action,
            EntityType   = entityType,
            EntityId     = entityId,
            ActorType    = Enum.TryParse<AuditActorType>(actor.ActorType, true, out var t) ? t : AuditActorType.System,
            ActorId      = actor.ActorId,
            ActorDisplay = actor.ActorDisplay,
            BeforeState  = before is null ? null : JsonSerializer.Serialize(before),
            AfterState   = after  is null ? null : JsonSerializer.Serialize(after),
            CreatedAt    = DateTime.UtcNow,
        };

        db.AuditLogs.Add(log);
        await db.SaveChangesAsync();
    }

    // Overload for system-generated events (no HTTP actor)
    public async Task LogSystemAsync<T>(
        string action,
        string entityType,
        string entityId,
        T? before = default,
        T? after  = default)
    {
        var log = new AuditLog
        {
            Action      = action,
            EntityType  = entityType,
            EntityId    = entityId,
            ActorType   = AuditActorType.System,
            BeforeState = before is null ? null : JsonSerializer.Serialize(before),
            AfterState  = after  is null ? null : JsonSerializer.Serialize(after),
            CreatedAt   = DateTime.UtcNow,
        };

        db.AuditLogs.Add(log);
        await db.SaveChangesAsync();
    }
}
