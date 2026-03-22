namespace TabHub.API.Domain.Entities;

public class OrderItem
{
    public Guid    Id           { get; set; } = Guid.NewGuid();
    public Guid    OrderId      { get; set; }
    public Guid    MenuItemId   { get; set; }
    public string  MenuItemName { get; set; } = string.Empty; // snapshot
    public decimal UnitPrice    { get; set; }                  // snapshot
    public int     Quantity     { get; set; }
    public string? Notes        { get; set; }

    public Order    Order    { get; set; } = null!;
    public MenuItem MenuItem { get; set; } = null!;
}
