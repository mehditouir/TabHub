using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Multitenancy;
using TabHub.API.Infrastructure.Persistence;

namespace TabHub.API.API.Controllers;

[ApiController]
[Route("auth")]
public class AuthController(
    AppDbContext   db,
    TokenService   tokens,
    ArgonHasher    argon,
    IOptions<JwtSettings> jwtOpts) : ControllerBase
{
    private readonly JwtSettings _jwt = jwtOpts.Value;

    // ── Manager Registration ─────────────────────────────────────────────────

    /// <summary>Register a manager account for the current tenant.</summary>
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterManagerRequest req)
    {
        var tenant = HttpContext.Items[nameof(TenantContext)] as TenantContext;
        if (tenant is null) return BadRequest(new { error = "Tenant not resolved." });

        if (await db.Managers.AnyAsync(m => m.Email == req.Email))
            return Conflict(new { error = "Email already registered." });

        var manager = new Manager
        {
            Email        = req.Email.ToLowerInvariant().Trim(),
            PasswordHash = argon.Hash(req.Password),
            DisplayName  = req.DisplayName,
        };

        // First manager for this tenant gets Owner role
        var isFirstManager = !await db.ManagerTenants.AnyAsync(mt => mt.TenantId == tenant.TenantId);

        db.Managers.Add(manager);
        db.ManagerTenants.Add(new ManagerTenant
        {
            ManagerId = manager.Id,
            TenantId  = tenant.TenantId,
            Role      = isFirstManager ? ManagerRole.Owner : ManagerRole.Admin,
        });

        await db.SaveChangesAsync();

        return Created($"/managers/{manager.Id}", new { manager.Id, manager.Email, manager.DisplayName });
    }

    // ── Manager Login ────────────────────────────────────────────────────────

    /// <summary>Login with email and password. Returns access token; sets httpOnly refresh cookie.</summary>
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var tenant = HttpContext.Items[nameof(TenantContext)] as TenantContext;
        if (tenant is null) return BadRequest(new { error = "Tenant not resolved." });

        var manager = await db.Managers
            .FirstOrDefaultAsync(m => m.Email == req.Email.ToLowerInvariant().Trim());

        if (manager is null || !manager.IsActive || !argon.Verify(req.Password, manager.PasswordHash))
            return Unauthorized(new { error = "Invalid credentials." });

        var managerTenant = await db.ManagerTenants
            .FirstOrDefaultAsync(mt => mt.ManagerId == manager.Id && mt.TenantId == tenant.TenantId);

        if (managerTenant is null)
            return Forbidden("Manager does not belong to this tenant.");

        return Ok(await IssueTokensAsync(manager, tenant.TenantId, managerTenant.Role));
    }

    // ── Token Refresh ────────────────────────────────────────────────────────

    /// <summary>Exchange a valid refresh token cookie for a new access token.</summary>
    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        var tenant = HttpContext.Items[nameof(TenantContext)] as TenantContext;
        if (tenant is null) return BadRequest(new { error = "Tenant not resolved." });

        var raw = Request.Cookies["refresh_token"];
        if (string.IsNullOrEmpty(raw)) return Unauthorized(new { error = "No refresh token." });

        var hash  = tokens.HashRefreshToken(raw);
        var token = await db.RefreshTokens
            .Include(r => r.Manager)
            .FirstOrDefaultAsync(r => r.TokenHash == hash);

        if (token is null || token.RevokedAt.HasValue || token.ExpiresAt < DateTime.UtcNow)
            return Unauthorized(new { error = "Refresh token invalid or expired." });

        var managerTenant = await db.ManagerTenants
            .FirstOrDefaultAsync(mt => mt.ManagerId == token.ManagerId && mt.TenantId == tenant.TenantId);

        if (managerTenant is null) return Forbidden("Manager does not belong to this tenant.");

        // Rotate: revoke old token, issue new pair
        token.RevokedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(await IssueTokensAsync(token.Manager, tenant.TenantId, managerTenant.Role));
    }

    // ── Logout ───────────────────────────────────────────────────────────────

    /// <summary>Revoke the current refresh token.</summary>
    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var raw = Request.Cookies["refresh_token"];
        if (!string.IsNullOrEmpty(raw))
        {
            var hash  = tokens.HashRefreshToken(raw);
            var token = await db.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == hash);
            if (token is not null) { token.RevokedAt = DateTime.UtcNow; await db.SaveChangesAsync(); }
        }

        Response.Cookies.Delete("refresh_token", new CookieOptions { Path = "/auth" });
        return NoContent();
    }

    // ── Staff PIN Login ──────────────────────────────────────────────────────

    /// <summary>Login as staff with a PIN. Returns a short-lived access token.</summary>
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("staff/pin-login")]
    public async Task<IActionResult> StaffPinLogin([FromBody] StaffPinLoginRequest req)
    {
        var tenant = HttpContext.Items[nameof(TenantContext)] as TenantContext;
        if (tenant is null) return BadRequest(new { error = "Tenant not resolved." });

        var activeStaff = await db.Staff
            .Where(s => s.IsActive)
            .ToListAsync();

        var pinHasher = new PinHasher();
        var staff     = activeStaff.FirstOrDefault(s => pinHasher.Verify(req.Pin, s.PinHash));

        if (staff is null) return Unauthorized(new { error = "Invalid PIN." });

        var accessToken = tokens.GenerateStaffAccessToken(staff, tenant.TenantId);

        return Ok(new StaffLoginResponse(
            AccessToken: accessToken,
            ExpiresAt:   DateTime.UtcNow.AddHours(12),
            StaffId:     staff.Id.ToString(),
            DisplayName: staff.DisplayName,
            Role:        staff.Role.ToString().ToLowerInvariant()));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<LoginResponse> IssueTokensAsync(Manager manager, Guid tenantId, ManagerRole role)
    {
        var accessToken = tokens.GenerateManagerAccessToken(manager, tenantId, role);
        var (raw, hash) = tokens.GenerateRefreshToken();

        db.RefreshTokens.Add(new RefreshToken
        {
            ManagerId = manager.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddDays(_jwt.RefreshTokenDays),
        });
        await db.SaveChangesAsync();

        Response.Cookies.Append("refresh_token", raw, new CookieOptions
        {
            HttpOnly  = true,
            Secure    = !HttpContext.RequestServices
                           .GetRequiredService<IWebHostEnvironment>().IsDevelopment(),
            SameSite  = SameSiteMode.Strict,
            Expires   = DateTimeOffset.UtcNow.AddDays(_jwt.RefreshTokenDays),
            Path      = "/auth",
        });

        return new LoginResponse(
            AccessToken: accessToken,
            ExpiresAt:   DateTime.UtcNow.AddMinutes(_jwt.AccessTokenMinutes),
            ManagerId:   manager.Id.ToString(),
            DisplayName: manager.DisplayName,
            Email:       manager.Email,
            Role:        role.ToString().ToLowerInvariant());
    }

    private ObjectResult Forbidden(string message) =>
        StatusCode(StatusCodes.Status403Forbidden, new { error = message });
}
