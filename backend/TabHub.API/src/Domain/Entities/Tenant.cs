using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class Tenant
{
    public Guid         Id         { get; set; }
    public string       Slug       { get; set; } = string.Empty;
    public string       SchemaName { get; set; } = string.Empty;
    public string       Name       { get; set; } = string.Empty;
    public TenantStatus Status     { get; set; } = TenantStatus.Active;
    public DateTime     CreatedAt  { get; set; } = DateTime.UtcNow;
    public DateTime     UpdatedAt  { get; set; } = DateTime.UtcNow;

    // Computed — not mapped to a DB column
    public bool IsActive => Status == TenantStatus.Active;

    public ICollection<ManagerTenant> ManagerTenants { get; set; } = [];
}
