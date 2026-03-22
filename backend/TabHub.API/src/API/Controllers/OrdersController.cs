using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Multitenancy;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Realtime;
using TabHub.API.Infrastructure.Services;

namespace TabHub.API.API.Controllers;

[ApiController]
[Authorize]
[Route("orders")]
public class OrdersController(
    AppDbContext db,
    AuditService audit,
    ICurrentActor actor,
    IHubContext<OrderHub> hub) : ControllerBase
{
    private TenantContext? TenantCtx => HttpContext.Items[nameof(TenantContext)] as TenantContext;

    // ── Public: customer places a dine-in order via QR token (starts Pending) ──

    [AllowAnonymous]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest req)
    {
        if (TenantCtx is null) return BadRequest(new { error = "Unable to resolve tenant." });

        var table = await db.Tables.FirstOrDefaultAsync(t => t.QrToken == req.QrToken && t.IsActive);
        if (table is null)
            return NotFound(new { error = "Invalid or inactive QR code." });

        if (!req.Items.Any())
            return BadRequest(new { error = "Order must contain at least one item." });

        var menuItemIds = req.Items.Select(i => i.MenuItemId).Distinct().ToList();
        var menuItems = await db.MenuItems
            .Where(m => menuItemIds.Contains(m.Id) && m.IsAvailable)
            .ToDictionaryAsync(m => m.Id);

        var missing = menuItemIds.Except(menuItems.Keys).ToList();
        if (missing.Count > 0)
            return BadRequest(new { error = "One or more items are unavailable or do not exist.", items = missing });

        // Auto-link to the table's active session (if any)
        var activeSession = await db.TableSessions
            .FirstOrDefaultAsync(s => s.TableId == table.Id && s.ClosedAt == null);

        var order = new Order { TableId = table.Id, OrderType = OrderType.DineIn, SessionId = activeSession?.Id };

        foreach (var line in req.Items)
        {
            if (line.Quantity < 1)
                return BadRequest(new { error = $"Quantity must be at least 1 for item {line.MenuItemId}." });

            var mi = menuItems[line.MenuItemId];
            order.Items.Add(new OrderItem
            {
                MenuItemId   = mi.Id,
                MenuItemName = mi.Name,
                UnitPrice    = mi.Price,
                Quantity     = line.Quantity,
                Notes        = line.Notes,
            });
        }

        if (req.Notes is not null) order.Notes = req.Notes;

        db.Orders.Add(order);
        await db.SaveChangesAsync();
        await audit.LogSystemAsync("create", nameof(Order), order.Id.ToString(),
            after: new { order.TableId, order.OrderType, order.Status, ItemCount = order.Items.Count });

        var dto = await LoadDtoAsync(order.Id);

        // Persist notification
        var notification = new Notification
        {
            EventType = "OrderPlaced",
            OrderId   = order.Id,
            TableId   = order.TableId,
        };
        db.Notifications.Add(notification);
        await db.SaveChangesAsync();

        // Broadcast to all clients (kitchen, cashier, general)
        await hub.Clients.Group(OrderHub.TenantGroup(TenantCtx.SchemaName))
            .SendAsync("OrderPlaced", dto);

        // Zone-based notification: find covering waiters; fallback to manager group
        var coveringStaff = order.TableId.HasValue
            ? await FindCoveringWaitersAsync(order.TableId.Value)
            : [];

        var notifPayload = new { notificationId = notification.Id, order = dto };
        if (coveringStaff.Count > 0)
        {
            foreach (var staffId in coveringStaff)
                await hub.Clients.Group(OrderHub.StaffGroup(staffId.ToString()))
                    .SendAsync("NewOrderNotification", notifPayload);
        }
        else
        {
            await hub.Clients.Group(OrderHub.ManagerGroup(TenantCtx.SchemaName))
                .SendAsync("NewOrderNotification", notifPayload);
        }

        return Created($"/orders/{order.Id}", dto);
    }

    // ── Staff: dine-in order — bypasses Pending, starts InProgress ────────────

    [HttpPost("staff")]
    public async Task<IActionResult> CreateStaff([FromBody] StaffCreateOrderRequest req)
    {
        if (TenantCtx is null) return BadRequest(new { error = "Unable to resolve tenant." });

        var table = await db.Tables.FirstOrDefaultAsync(t => t.Id == req.TableId && t.IsActive);
        if (table is null)
            return NotFound(new { error = "Table not found or inactive." });

        if (!req.Items.Any())
            return BadRequest(new { error = "Order must contain at least one item." });

        var menuItemIds = req.Items.Select(i => i.MenuItemId).Distinct().ToList();
        var menuItems = await db.MenuItems
            .Where(m => menuItemIds.Contains(m.Id) && m.IsAvailable)
            .ToDictionaryAsync(m => m.Id);

        var missing = menuItemIds.Except(menuItems.Keys).ToList();
        if (missing.Count > 0)
            return BadRequest(new { error = "One or more items are unavailable or do not exist.", items = missing });

        var order = new Order
        {
            TableId   = table.Id,
            SessionId = req.SessionId,
            OrderType = OrderType.DineIn,
            Status    = OrderStatus.InProgress, // bypass: staff skips Pending
        };

        foreach (var line in req.Items)
        {
            if (line.Quantity < 1)
                return BadRequest(new { error = $"Quantity must be at least 1 for item {line.MenuItemId}." });

            var mi = menuItems[line.MenuItemId];
            order.Items.Add(new OrderItem
            {
                MenuItemId   = mi.Id,
                MenuItemName = mi.Name,
                UnitPrice    = mi.Price,
                Quantity     = line.Quantity,
                Notes        = line.Notes,
            });
        }

        if (req.Notes is not null) order.Notes = req.Notes;

        db.Orders.Add(order);
        await db.SaveChangesAsync();
        await audit.LogAsync("create", nameof(Order), order.Id.ToString(), actor,
            after: new { order.TableId, order.SessionId, order.OrderType, order.Status, ItemCount = order.Items.Count });

        var dto = await LoadDtoAsync(order.Id);

        var notification = new Notification { EventType = "OrderPlaced", OrderId = order.Id, TableId = order.TableId };
        db.Notifications.Add(notification);
        await db.SaveChangesAsync();

        await hub.Clients.Group(OrderHub.TenantGroup(TenantCtx.SchemaName)).SendAsync("OrderPlaced", dto);

        var coveringStaff2 = order.TableId.HasValue ? await FindCoveringWaitersAsync(order.TableId.Value) : [];
        var notifPayload2  = new { notificationId = notification.Id, order = dto };
        if (coveringStaff2.Count > 0)
            foreach (var sid in coveringStaff2)
                await hub.Clients.Group(OrderHub.StaffGroup(sid.ToString())).SendAsync("NewOrderNotification", notifPayload2);
        else
            await hub.Clients.Group(OrderHub.ManagerGroup(TenantCtx.SchemaName)).SendAsync("NewOrderNotification", notifPayload2);

        return Created($"/orders/{order.Id}", dto);
    }

    // ── Cashier: takeaway order — no table, daily sequence number ─────────────

    [HttpPost("takeaway")]
    public async Task<IActionResult> CreateTakeaway([FromBody] CreateTakeawayOrderRequest req)
    {
        if (TenantCtx is null) return BadRequest(new { error = "Unable to resolve tenant." });

        if (!req.Items.Any())
            return BadRequest(new { error = "Order must contain at least one item." });

        var menuItemIds = req.Items.Select(i => i.MenuItemId).Distinct().ToList();
        var menuItems = await db.MenuItems
            .Where(m => menuItemIds.Contains(m.Id) && m.IsAvailable)
            .ToDictionaryAsync(m => m.Id);

        var missing = menuItemIds.Except(menuItems.Keys).ToList();
        if (missing.Count > 0)
            return BadRequest(new { error = "One or more items are unavailable or do not exist.", items = missing });

        // Daily sequence: YYYYMMDDNNNNN (8-digit date + 5-digit counter)
        var today = DateTime.UtcNow.ToString("yyyyMMdd");
        var todayCount = await db.Orders
            .CountAsync(o => o.OrderType == OrderType.Takeaway
                          && o.SequenceNumber != null
                          && o.SequenceNumber.StartsWith(today));
        var sequenceNumber = $"{today}{(todayCount + 1):D5}";

        var order = new Order
        {
            OrderType      = OrderType.Takeaway,
            SequenceNumber = sequenceNumber,
            Status         = OrderStatus.InProgress,
        };

        foreach (var line in req.Items)
        {
            if (line.Quantity < 1)
                return BadRequest(new { error = $"Quantity must be at least 1 for item {line.MenuItemId}." });

            var mi = menuItems[line.MenuItemId];
            order.Items.Add(new OrderItem
            {
                MenuItemId   = mi.Id,
                MenuItemName = mi.Name,
                UnitPrice    = mi.Price,
                Quantity     = line.Quantity,
                Notes        = line.Notes,
            });
        }

        if (req.Notes is not null) order.Notes = req.Notes;

        db.Orders.Add(order);
        await db.SaveChangesAsync();
        await audit.LogAsync("create_takeaway", nameof(Order), order.Id.ToString(), actor,
            after: new { order.OrderType, order.SequenceNumber, order.Status, ItemCount = order.Items.Count });

        var dto = await LoadDtoAsync(order.Id);

        var notifTakeaway = new Notification { EventType = "OrderPlaced", OrderId = order.Id };
        db.Notifications.Add(notifTakeaway);
        await db.SaveChangesAsync();

        await hub.Clients.Group(OrderHub.TenantGroup(TenantCtx.SchemaName)).SendAsync("OrderPlaced", dto);

        // Takeaway: no table → always notify managers
        var notifTakeawayPayload = new { notificationId = notifTakeaway.Id, order = dto };
        await hub.Clients.Group(OrderHub.ManagerGroup(TenantCtx.SchemaName))
            .SendAsync("NewOrderNotification", notifTakeawayPayload);

        return Created($"/orders/{order.Id}", dto);
    }

    // ── Staff: list orders ────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] Guid? tableId, [FromQuery] string? orderType)
    {
        var query = db.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
            .AsQueryable();

        if (status is not null)
        {
            if (!Enum.TryParse<OrderStatus>(status, true, out var parsedStatus))
                return BadRequest(new { error = $"Invalid status '{status}'." });
            query = query.Where(o => o.Status == parsedStatus);
        }

        if (orderType is not null)
        {
            if (!Enum.TryParse<OrderType>(orderType, true, out var parsedType))
                return BadRequest(new { error = $"Invalid orderType '{orderType}'." });
            query = query.Where(o => o.OrderType == parsedType);
        }

        if (tableId.HasValue)
            query = query.Where(o => o.TableId == tableId.Value);

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
        return Ok(orders.Select(MapToDto));
    }

    // ── Public: takeaway board — active takeaway orders for display screen ────

    [AllowAnonymous]
    [HttpGet("takeaway-board")]
    public async Task<IActionResult> TakeawayBoard()
    {
        if (TenantCtx is null) return BadRequest(new { error = "Unable to resolve tenant." });

        var activeStatuses = new[] { OrderStatus.Pending, OrderStatus.InProgress, OrderStatus.Ready };

        var orders = await db.Orders
            .Include(o => o.Items)
            .Where(o => o.OrderType == OrderType.Takeaway && activeStatuses.Contains(o.Status))
            .OrderBy(o => o.CreatedAt)
            .ToListAsync();

        return Ok(orders.Select(MapToDto));
    }

    // ── Staff: get single order ───────────────────────────────────────────────

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var order = await db.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);

        return order is null ? NotFound() : Ok(MapToDto(order));
    }

    // ── Staff/Manager: PDF bill ───────────────────────────────────────────────

    [HttpGet("{id:guid}/bill.pdf")]
    public async Task<IActionResult> GetBill(Guid id)
    {
        var order = await db.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);
        if (order is null) return NotFound();

        var restaurantName = (await db.Configs.FindAsync("restaurant_name"))?.Value ?? "Restaurant";
        var tvaRateStr     = (await db.Configs.FindAsync("tva_rate"))?.Value ?? "0";
        var tvaRate        = decimal.TryParse(tvaRateStr,
                                System.Globalization.NumberStyles.Any,
                                System.Globalization.CultureInfo.InvariantCulture, out var r)
                            ? r / 100m : 0m;

        var subtotal  = order.Total;
        var tvaAmount = Math.Round(subtotal * tvaRate, 3);
        var total     = subtotal + tvaAmount;

        var pdfBytes = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A5);
                page.Margin(1.5f, Unit.Centimetre);
                page.DefaultTextStyle(t => t.FontSize(11));

                page.Content().Column(col =>
                {
                    col.Spacing(5);

                    col.Item().Text(restaurantName)
                        .Bold().FontSize(16).AlignCenter();

                    col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Medium);

                    col.Item().Text($"Date : {order.CreatedAt.ToLocalTime():dd/MM/yyyy HH:mm}");

                    if (order.OrderType == OrderType.Takeaway)
                        col.Item().Text($"Commande à emporter  #{order.SequenceNumber}").Bold();
                    else if (order.Table is not null)
                        col.Item().Text($"Table : {order.Table.Number}");

                    col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Medium);

                    // Items table
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(cols =>
                        {
                            cols.RelativeColumn();
                            cols.ConstantColumn(35);
                            cols.ConstantColumn(75);
                        });

                        t.Header(h =>
                        {
                            h.Cell().Text("Article").Bold();
                            h.Cell().AlignCenter().Text("Qté").Bold();
                            h.Cell().AlignRight().Text("Prix (TND)").Bold();
                        });

                        foreach (var item in order.Items)
                        {
                            t.Cell().Text(item.MenuItemName);
                            t.Cell().AlignCenter().Text(item.Quantity.ToString());
                            t.Cell().AlignRight().Text($"{item.UnitPrice * item.Quantity:F3}");
                        }
                    });

                    col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Medium);

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Text("Sous-total (HT)");
                        row.ConstantItem(75).AlignRight().Text($"{subtotal:F3} TND");
                    });

                    if (tvaRate > 0)
                    {
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Text($"TVA ({tvaRate * 100:F0}%)");
                            row.ConstantItem(75).AlignRight().Text($"{tvaAmount:F3} TND");
                        });
                    }

                    col.Item().LineHorizontal(1).LineColor(Colors.Black);

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Text("Total (TTC)").Bold().FontSize(13);
                        row.ConstantItem(75).AlignRight().Text($"{total:F3} TND").Bold().FontSize(13);
                    });
                });
            });
        }).GeneratePdf();

        return File(pdfBytes, "application/pdf", $"facture-{order.Id}.pdf");
    }

    // ── Staff: advance order status ───────────────────────────────────────────

    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateOrderStatusRequest req)
    {
        if (!Enum.TryParse<OrderStatus>(req.Status, true, out var newStatus))
            return BadRequest(new { error = $"Invalid status '{req.Status}'. Valid values: Pending, InProgress, Ready, Completed, Cancelled." });

        var order = await db.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);
        if (order is null) return NotFound();

        var before = new { order.Status };
        order.Status    = newStatus;
        order.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("status_update", nameof(Order), order.Id.ToString(), actor,
            before, after: new { order.Status });

        var dto = MapToDto(order);
        if (TenantCtx is not null)
            await hub.Clients.Group(OrderHub.TenantGroup(TenantCtx.SchemaName))
                .SendAsync("OrderStatusChanged", dto);

        return Ok(dto);
    }

    // ── Staff: cancel order ───────────────────────────────────────────────────

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var order = await db.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);
        if (order is null) return NotFound();

        if (order.Status == OrderStatus.Completed)
            return Conflict(new { error = "Cannot cancel a completed order." });

        var before = new { order.Status };
        order.Status    = OrderStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("cancel", nameof(Order), order.Id.ToString(), actor,
            before, after: new { order.Status });

        var dto = MapToDto(order);
        if (TenantCtx is not null)
            await hub.Clients.Group(OrderHub.TenantGroup(TenantCtx.SchemaName))
                .SendAsync("OrderCancelled", dto);

        return NoContent();
    }

    // ── Customer: call waiter ─────────────────────────────────────────────────

    [AllowAnonymous]
    [HttpPost("call-waiter")]
    public async Task<IActionResult> CallWaiter([FromBody] CustomerTableRequest req)
    {
        if (TenantCtx is null) return BadRequest(new { error = "Unable to resolve tenant." });

        var table = await db.Tables.FirstOrDefaultAsync(t => t.QrToken == req.QrToken && t.IsActive);
        if (table is null) return NotFound(new { error = "Invalid or inactive QR code." });

        var payload = new { tableId = table.Id, tableNumber = table.Number };
        var covering = await FindCoveringWaitersAsync(table.Id);

        if (covering.Count > 0)
            foreach (var staffId in covering)
                await hub.Clients.Group(OrderHub.StaffGroup(staffId.ToString())).SendAsync("WaiterCalled", payload);
        else
            await hub.Clients.Group(OrderHub.ManagerGroup(TenantCtx.SchemaName)).SendAsync("WaiterCalled", payload);

        return Ok();
    }

    // ── Customer: request bill ────────────────────────────────────────────────

    [AllowAnonymous]
    [HttpPost("request-bill")]
    public async Task<IActionResult> RequestBill([FromBody] CustomerTableRequest req)
    {
        if (TenantCtx is null) return BadRequest(new { error = "Unable to resolve tenant." });

        var table = await db.Tables.FirstOrDefaultAsync(t => t.QrToken == req.QrToken && t.IsActive);
        if (table is null) return NotFound(new { error = "Invalid or inactive QR code." });

        var payload = new { tableId = table.Id, tableNumber = table.Number };
        var covering = await FindCoveringWaitersAsync(table.Id);

        if (covering.Count > 0)
            foreach (var staffId in covering)
                await hub.Clients.Group(OrderHub.StaffGroup(staffId.ToString())).SendAsync("BillRequested", payload);
        else
            await hub.Clients.Group(OrderHub.ManagerGroup(TenantCtx.SchemaName)).SendAsync("BillRequested", payload);

        return Ok();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<List<Guid>> FindCoveringWaitersAsync(Guid tableId)
    {
        var table = await db.Tables.FindAsync(tableId);
        if (table is null) return [];

        return await db.WaiterZones
            .Where(z => z.SpaceId == table.SpaceId
                     && z.ColStart <= table.Col && table.Col <= z.ColEnd
                     && z.RowStart <= table.Row && table.Row <= z.RowEnd)
            .Select(z => z.StaffId)
            .Distinct()
            .ToListAsync();
    }

    private async Task<OrderDto> LoadDtoAsync(Guid id)
    {
        var order = await db.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
            .FirstAsync(o => o.Id == id);
        return MapToDto(order);
    }

    public static OrderDto MapOrderToDto(Order o) => MapToDto(o);

    private static OrderDto MapToDto(Order o) => new(
        o.Id,
        o.TableId,
        o.Table?.Number,
        o.OrderType.ToString(),
        o.SequenceNumber,
        o.Status.ToString(),
        o.Notes,
        o.Total,
        o.CreatedAt,
        o.UpdatedAt,
        o.Items.Select(i => new OrderItemDto(i.Id, i.MenuItemId, i.MenuItemName, i.UnitPrice, i.Quantity, i.Notes)));
}
