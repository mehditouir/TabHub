namespace TabHub.API.Infrastructure.Multitenancy;

public class TenantContext
{
    public Guid TenantId { get; init; }
    public string Slug { get; init; } = string.Empty;
    public string SchemaName { get; init; } = string.Empty;
}
