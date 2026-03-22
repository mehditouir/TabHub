namespace TabHub.API.Domain.Entities;

public class Notification
{
    public Guid       Id                     { get; set; } = Guid.NewGuid();
    public string     EventType              { get; set; } = string.Empty; // OrderPlaced | OrderStatusChanged | OrderCancelled
    public Guid       OrderId                { get; set; }
    public Guid?      TableId                { get; set; }
    public bool       IsAcknowledged         { get; set; } = false;
    public Guid?      AcknowledgedByStaffId  { get; set; }
    public DateTime?  AcknowledgedAt         { get; set; }
    public DateTime   CreatedAt              { get; set; } = DateTime.UtcNow;

    public Order  Order { get; set; } = null!;
    public Staff? AcknowledgedByStaff { get; set; }
}
