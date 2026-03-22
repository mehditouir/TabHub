namespace TabHub.API.API.Dtos;

public record RevenueDayDto(DateOnly Date, decimal Revenue, int OrderCount);

public record RevenueReportDto(
    DateTime From,
    DateTime To,
    decimal TotalRevenue,
    int TotalOrders,
    IEnumerable<RevenueDayDto> ByDay);

public record TopItemDto(
    Guid   MenuItemId,
    string Name,
    int    TotalQuantity,
    decimal TotalRevenue);

public record OrderSummaryDto(
    int TotalOrders,
    int Pending,
    int InProgress,
    int Ready,
    int Completed,
    int Cancelled,
    double? AvgCompletionMinutes);  // Pending → Completed, null if no completed orders

public record BusyHourDto(int Hour, int OrderCount);
