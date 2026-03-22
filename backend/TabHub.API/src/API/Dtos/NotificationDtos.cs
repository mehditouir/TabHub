namespace TabHub.API.API.Dtos;

public record NotificationDto(
    Guid      Id,
    string    EventType,
    Guid      OrderId,
    Guid?     TableId,
    bool      IsAcknowledged,
    Guid?     AcknowledgedByStaffId,
    string?   AcknowledgedByStaffName,
    DateTime? AcknowledgedAt,
    DateTime  CreatedAt,
    OrderDto  Order);
