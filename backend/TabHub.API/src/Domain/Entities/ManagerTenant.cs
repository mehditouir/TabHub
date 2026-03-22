using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class ManagerTenant
{
    public Guid        ManagerId { get; set; }
    public Guid        TenantId  { get; set; }
    public ManagerRole Role      { get; set; } = ManagerRole.Admin;
    public DateTime    CreatedAt { get; set; } = DateTime.UtcNow;

    public Manager Manager { get; set; } = null!;
    public Tenant  Tenant  { get; set; } = null!;
}
