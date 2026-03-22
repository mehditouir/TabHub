using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using TabHub.API.Infrastructure.Multitenancy;

namespace TabHub.API.Infrastructure.Realtime;

/// <summary>
/// Real-time hub for order events. Group membership:
///   tenant_{schema}  — all connected clients in the tenant (kitchen, cashier, general)
///   manager_{schema} — managers; fallback when no waiter covers a zone
///   staff_{staffId}  — per-waiter group for zone-targeted notifications
///   table_{tableId}  — per-table group for customer-facing order status updates
/// </summary>
[AllowAnonymous]
public class OrderHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var tenantCtx = Context.GetHttpContext()?.Items[nameof(TenantContext)] as TenantContext;
        if (tenantCtx is null)
        {
            await base.OnConnectedAsync();
            return;
        }

        // All clients join the tenant broadcast group
        await Groups.AddToGroupAsync(Context.ConnectionId, TenantGroup(tenantCtx.SchemaName));

        // Authenticated clients join their role-specific group
        if (Context.User?.Identity?.IsAuthenticated == true)
        {
            var actorType = Context.User.FindFirst("actor_type")?.Value;
            var sub       = Context.User.FindFirst("sub")?.Value;

            if (actorType == "manager")
                await Groups.AddToGroupAsync(Context.ConnectionId, ManagerGroup(tenantCtx.SchemaName));
            else if (actorType == "staff" && sub is not null)
                await Groups.AddToGroupAsync(Context.ConnectionId, StaffGroup(sub));
        }

        // Customer-facing: join per-table group if tableId query param supplied
        var tableId = Context.GetHttpContext()?.Request.Query["tableId"].ToString();
        if (!string.IsNullOrEmpty(tableId))
            await Groups.AddToGroupAsync(Context.ConnectionId, TableGroup(tableId));

        await base.OnConnectedAsync();
    }

    /// <summary>Allows a client to opt into a specific table's real-time feed at runtime.</summary>
    public async Task JoinTableGroup(string tableId) =>
        await Groups.AddToGroupAsync(Context.ConnectionId, TableGroup(tableId));

    /// <summary>
    /// Broadcasts a customer's cart state to all other devices on the same table.
    /// Uses OthersInGroup so the sender does not receive its own broadcast.
    /// </summary>
    public async Task BroadcastCart(string tableId, object cartItems) =>
        await Clients.OthersInGroup(TableGroup(tableId)).SendAsync("CartUpdated", cartItems);

    // ── Group name helpers ────────────────────────────────────────────────────

    public static string TenantGroup(string schema)  => $"tenant_{schema}";
    public static string ManagerGroup(string schema) => $"manager_{schema}";
    public static string StaffGroup(string staffId)  => $"staff_{staffId}";
    public static string TableGroup(string tableId)  => $"table_{tableId}";
}
