namespace TabHub.API.API.Dtos;

public record CreateOrderItemRequest(Guid MenuItemId, int Quantity, string? Notes = null);

// Customer QR order (anonymous, DineIn, starts Pending)
public record CreateOrderRequest(Guid QrToken, IEnumerable<CreateOrderItemRequest> Items, string? Notes = null);

// Staff dine-in order (authenticated, starts InProgress)
public record StaffCreateOrderRequest(Guid TableId, IEnumerable<CreateOrderItemRequest> Items, Guid? SessionId = null, string? Notes = null);

// Cashier takeaway order (authenticated, no table, generates sequence number)
public record CreateTakeawayOrderRequest(IEnumerable<CreateOrderItemRequest> Items, string? Notes = null);

public record UpdateOrderStatusRequest(string Status);

// Customer anonymous actions (call waiter, request bill) via QR token
public record CustomerTableRequest(Guid QrToken);

public record OrderItemDto(
    Guid    Id,
    Guid    MenuItemId,
    string  MenuItemName,
    decimal UnitPrice,
    int     Quantity,
    string? Notes);

public record OrderDto(
    Guid      Id,
    Guid?     TableId,
    string?   TableNumber,
    string    OrderType,
    string?   SequenceNumber,
    string    Status,
    string?   Notes,
    decimal   Total,
    DateTime  CreatedAt,
    DateTime  UpdatedAt,
    IEnumerable<OrderItemDto> Items);
