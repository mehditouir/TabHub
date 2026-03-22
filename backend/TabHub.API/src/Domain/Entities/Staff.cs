using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class Staff
{
    public Guid      Id          { get; set; } = Guid.NewGuid();
    public string    DisplayName { get; set; } = string.Empty;
    public StaffRole Role        { get; set; }
    public string    PinHash     { get; set; } = string.Empty;
    public bool      IsActive    { get; set; } = true;
    public DateTime  CreatedAt   { get; set; } = DateTime.UtcNow;
    public DateTime  UpdatedAt   { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt   { get; set; }

    public ICollection<WaiterZone> WaiterZones { get; set; } = [];
}
