using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class AuditLog
{
    public Guid           Id           { get; set; } = Guid.NewGuid();
    public string         EntityType   { get; set; } = string.Empty;
    public string         EntityId     { get; set; } = string.Empty;
    public string         Action       { get; set; } = string.Empty;
    public AuditActorType ActorType    { get; set; }
    public string?        ActorId      { get; set; }
    public string?        ActorDisplay { get; set; }
    public string?        BeforeState  { get; set; }
    public string?        AfterState   { get; set; }
    public DateTime       CreatedAt    { get; set; } = DateTime.UtcNow;
}
