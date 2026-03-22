namespace TabHub.API.Infrastructure.Auth;

public interface ICurrentActor
{
    string  ActorType    { get; }  // "manager" | "staff" | "system"
    string? ActorId      { get; }
    string? ActorDisplay { get; }
    Guid    TenantId     { get; }
}
