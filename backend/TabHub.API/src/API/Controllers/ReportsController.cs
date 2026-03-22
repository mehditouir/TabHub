using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Persistence;

namespace TabHub.API.API.Controllers;

[Route("reports")]
public class ReportsController(AppDbContext db) : TenantControllerBase
{
    // ── Revenue by day ────────────────────────────────────────────────────────

    /// <summary>
    /// Revenue and order count grouped by day for the given date range.
    /// Defaults to the last 30 days if no parameters supplied.
    /// Only completed orders are counted as revenue.
    /// </summary>
    [HttpGet("revenue")]
    public async Task<IActionResult> Revenue(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
    {
        var start = (from ?? DateTime.UtcNow.AddDays(-30)).ToUniversalTime();
        var end   = (to   ?? DateTime.UtcNow).ToUniversalTime();

        if (start > end)
            return BadRequest(new { error = "'from' must be before 'to'." });

        var orders = await db.Orders
            .Include(o => o.Items)
            .Where(o => o.Status == OrderStatus.Completed
                     && o.UpdatedAt >= start
                     && o.UpdatedAt <= end)
            .ToListAsync();

        var byDay = orders
            .GroupBy(o => DateOnly.FromDateTime(o.UpdatedAt.Date))
            .Select(g => new RevenueDayDto(
                g.Key,
                g.Sum(o => o.Total),
                g.Count()))
            .OrderBy(d => d.Date)
            .ToList();

        return Ok(new RevenueReportDto(
            start,
            end,
            byDay.Sum(d => d.Revenue),
            byDay.Sum(d => d.OrderCount),
            byDay));
    }

    // ── Top selling items ─────────────────────────────────────────────────────

    /// <summary>
    /// Most ordered items by total quantity, across all completed orders.
    /// </summary>
    [HttpGet("top-items")]
    public async Task<IActionResult> TopItems([FromQuery] int limit = 10)
    {
        if (limit is < 1 or > 100)
            return BadRequest(new { error = "limit must be between 1 and 100." });

        var completedOrderIds = await db.Orders
            .Where(o => o.Status == OrderStatus.Completed)
            .Select(o => o.Id)
            .ToListAsync();

        var rawItems = await db.OrderItems
            .Where(i => completedOrderIds.Contains(i.OrderId))
            .ToListAsync();

        var items = rawItems
            .GroupBy(i => new { i.MenuItemId, i.MenuItemName })
            .Select(g => new TopItemDto(
                g.Key.MenuItemId,
                g.Key.MenuItemName,
                g.Sum(i => i.Quantity),
                g.Sum(i => i.UnitPrice * i.Quantity)))
            .OrderByDescending(i => i.TotalQuantity)
            .Take(limit)
            .ToList();

        return Ok(items);
    }

    // ── Orders summary ────────────────────────────────────────────────────────

    /// <summary>
    /// Count of orders by status and average time from Pending to Completed.
    /// </summary>
    [HttpGet("orders/summary")]
    public async Task<IActionResult> OrdersSummary()
    {
        var orders = await db.Orders.ToListAsync();

        var completed = orders.Where(o => o.Status == OrderStatus.Completed).ToList();
        double? avgMinutes = completed.Count > 0
            ? completed.Average(o => (o.UpdatedAt - o.CreatedAt).TotalMinutes)
            : null;

        return Ok(new OrderSummaryDto(
            TotalOrders:         orders.Count,
            Pending:             orders.Count(o => o.Status == OrderStatus.Pending),
            InProgress:          orders.Count(o => o.Status == OrderStatus.InProgress),
            Ready:               orders.Count(o => o.Status == OrderStatus.Ready),
            Completed:           completed.Count,
            Cancelled:           orders.Count(o => o.Status == OrderStatus.Cancelled),
            AvgCompletionMinutes: avgMinutes.HasValue ? Math.Round(avgMinutes.Value, 1) : null));
    }

    // ── Busiest hours ─────────────────────────────────────────────────────────

    /// <summary>
    /// Number of orders placed per hour of day (0–23), across all time.
    /// </summary>
    [HttpGet("busiest-hours")]
    public async Task<IActionResult> BusiestHours()
    {
        var orders = await db.Orders.ToListAsync();

        var byHour = orders
            .GroupBy(o => o.CreatedAt.Hour)
            .Select(g => new BusyHourDto(g.Key, g.Count()))
            .OrderBy(h => h.Hour)
            .ToList();

        return Ok(byHour);
    }
}
