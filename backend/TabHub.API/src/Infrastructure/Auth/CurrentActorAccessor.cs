using System.Security.Claims;

namespace TabHub.API.Infrastructure.Auth;

public class CurrentActorAccessor(IHttpContextAccessor http) : ICurrentActor
{
    private ClaimsPrincipal? User => http.HttpContext?.User;

    public string  ActorType    => User?.FindFirstValue("actor_type") ?? "system";
    public string? ActorId      => User?.FindFirstValue(ClaimTypes.NameIdentifier);
    public string? ActorDisplay => User?.FindFirstValue("name");
    public Guid    TenantId     => Guid.TryParse(User?.FindFirstValue("tenant_id"), out var id) ? id : Guid.Empty;
}
