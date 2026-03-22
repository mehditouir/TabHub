using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class Order
{
    public Guid        Id             { get; set; } = Guid.NewGuid();
    public Guid?       TableId        { get; set; }   // null for takeaway
    public Guid?       SessionId      { get; set; }
    public OrderType   OrderType      { get; set; } = OrderType.DineIn;
    public string?     SequenceNumber { get; set; }   // YYYYMMDDNNNNN for takeaway
    public OrderStatus Status         { get; set; } = OrderStatus.Pending;
    public string?     Notes          { get; set; }
    public DateTime    CreatedAt      { get; set; } = DateTime.UtcNow;
    public DateTime    UpdatedAt      { get; set; } = DateTime.UtcNow;

    public RestaurantTable?          Table   { get; set; }
    public TableSession?             Session { get; set; }
    public ICollection<OrderItem>    Items   { get; set; } = [];

    public decimal Total => Items.Sum(i => i.UnitPrice * i.Quantity);
}
