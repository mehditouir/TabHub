namespace TabHub.API.Domain.Entities;

public class TableSession
{
    public Guid       Id        { get; set; } = Guid.NewGuid();
    public Guid       TableId   { get; set; }
    public Guid?      StaffId   { get; set; }
    public string?    Notes     { get; set; }
    public DateTime   OpenedAt  { get; set; } = DateTime.UtcNow;
    public DateTime?  ClosedAt  { get; set; }

    public RestaurantTable           Table  { get; set; } = null!;
    public Staff?                    Staff  { get; set; }
    public ICollection<Order>        Orders { get; set; } = [];
}
