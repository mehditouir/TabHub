using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Persistence;

namespace TabHub.API.API.Controllers;

[ApiController]
[Route("admin")]
public class SuperAdminController(
    AppDbContext      db,
    TokenService      tokens,
    ArgonHasher       argon,
    SchemaProvisioner provisioner) : ControllerBase
{
    // ── Super Admin Login ─────────────────────────────────────────────────────

    /// <summary>Login as super admin (no tenant required).</summary>
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("auth/login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var manager = await db.Managers
            .FirstOrDefaultAsync(m => m.Email == req.Email.ToLowerInvariant().Trim());

        if (manager is null || !manager.IsActive || !manager.IsSuperAdmin
            || !argon.Verify(req.Password, manager.PasswordHash))
            return Unauthorized(new { error = "Invalid credentials." });

        var accessToken = tokens.GenerateSuperAdminAccessToken(manager);

        return Ok(new
        {
            accessToken,
            managerId   = manager.Id,
            displayName = manager.DisplayName,
            email       = manager.Email,
        });
    }

    // ── Tenants ───────────────────────────────────────────────────────────────

    /// <summary>List all tenants.</summary>
    [Authorize(Policy = "SuperAdminOnly")]
    [HttpGet("tenants")]
    public async Task<IActionResult> GetTenants()
    {
        var tenants = await db.Tenants
            .Select(t => new
            {
                t.Id, t.Slug, t.Name, t.SchemaName,
                status      = t.Status.ToString(),
                managerCount = db.ManagerTenants.Count(mt => mt.TenantId == t.Id),
            })
            .OrderBy(t => t.Name)
            .ToListAsync();

        return Ok(tenants);
    }

    /// <summary>Create a new tenant and provision its schema.</summary>
    [Authorize(Policy = "SuperAdminOnly")]
    [HttpPost("tenants")]
    public async Task<IActionResult> CreateTenant([FromBody] CreateTenantRequest req)
    {
        var slug = req.Slug.ToLowerInvariant().Trim();

        if (!System.Text.RegularExpressions.Regex.IsMatch(slug, @"^[a-z0-9]{3,63}$"))
            return BadRequest(new { error = "Slug must be 3–63 lowercase alphanumeric characters." });

        if (await db.Tenants.AnyAsync(t => t.Slug == slug))
            return Conflict(new { error = "Slug already taken." });

        var tenant = new Tenant
        {
            Slug       = slug,
            SchemaName = slug,
            Name       = req.Name.Trim(),
        };

        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        await provisioner.ProvisionAsync(tenant.SchemaName);

        return Created($"/admin/tenants/{tenant.Id}", new
        {
            tenant.Id, tenant.Slug, tenant.Name, tenant.SchemaName,
        });
    }

    // ── Managers ──────────────────────────────────────────────────────────────

    /// <summary>List all managers with their tenant assignments.</summary>
    [Authorize(Policy = "SuperAdminOnly")]
    [HttpGet("managers")]
    public async Task<IActionResult> GetManagers()
    {
        var managers = await db.Managers
            .Include(m => m.ManagerTenants).ThenInclude(mt => mt.Tenant)
            .Select(m => new
            {
                m.Id, m.Email, m.DisplayName, m.IsActive, m.IsSuperAdmin,
                tenants = m.ManagerTenants.Select(mt => new
                {
                    tenantId   = mt.TenantId,
                    slug       = mt.Tenant.Slug,
                    name       = mt.Tenant.Name,
                    role       = mt.Role.ToString().ToLowerInvariant(),
                }),
            })
            .OrderBy(m => m.Email)
            .ToListAsync();

        return Ok(managers);
    }

    /// <summary>Create a manager account and optionally assign to a tenant.</summary>
    [Authorize(Policy = "SuperAdminOnly")]
    [HttpPost("managers")]
    public async Task<IActionResult> CreateManager([FromBody] AdminCreateManagerRequest req)
    {
        if (await db.Managers.AnyAsync(m => m.Email == req.Email))
            return Conflict(new { error = "Email already registered." });

        var manager = new Manager
        {
            Email        = req.Email.ToLowerInvariant().Trim(),
            PasswordHash = argon.Hash(req.Password),
            DisplayName  = req.DisplayName.Trim(),
        };

        db.Managers.Add(manager);

        if (req.TenantId.HasValue)
        {
            var tenant = await db.Tenants.FindAsync(req.TenantId.Value);
            if (tenant is null)
                return NotFound(new { error = "Tenant not found." });

            db.ManagerTenants.Add(new ManagerTenant
            {
                ManagerId = manager.Id,
                TenantId  = req.TenantId.Value,
                Role      = ManagerRole.Owner,
            });
        }

        await db.SaveChangesAsync();

        return Created($"/admin/managers/{manager.Id}", new
        {
            manager.Id, manager.Email, manager.DisplayName,
        });
    }

    /// <summary>Assign an existing manager to a tenant.</summary>
    [Authorize(Policy = "SuperAdminOnly")]
    [HttpPost("tenants/{tenantId:guid}/managers")]
    public async Task<IActionResult> AssignManager(Guid tenantId, [FromBody] AssignManagerRequest req)
    {
        var tenant = await db.Tenants.FindAsync(tenantId);
        if (tenant is null) return NotFound(new { error = "Tenant not found." });

        var manager = await db.Managers.FindAsync(req.ManagerId);
        if (manager is null) return NotFound(new { error = "Manager not found." });

        if (await db.ManagerTenants.AnyAsync(mt => mt.ManagerId == req.ManagerId && mt.TenantId == tenantId))
            return Conflict(new { error = "Manager already assigned to this tenant." });

        if (!Enum.TryParse<ManagerRole>(req.Role, ignoreCase: true, out var role))
            role = ManagerRole.Admin;

        db.ManagerTenants.Add(new ManagerTenant
        {
            ManagerId = req.ManagerId,
            TenantId  = tenantId,
            Role      = role,
        });

        await db.SaveChangesAsync();

        return Ok(new { message = "Manager assigned." });
    }
}
