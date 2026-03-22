using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;

namespace TabHub.API.Infrastructure.Auth;

public class TokenService(IOptions<JwtSettings> options)
{
    private readonly JwtSettings _jwt = options.Value;

    public string GenerateManagerAccessToken(Manager manager, Guid tenantId, ManagerRole role)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,   manager.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, manager.Email),
            new Claim(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new Claim("name",        manager.DisplayName),
            new Claim("actor_type",  "manager"),
            new Claim("tenant_id",   tenantId.ToString()),
            new Claim("role",        role.ToString().ToLowerInvariant()),
        };

        return BuildToken(claims, TimeSpan.FromMinutes(_jwt.AccessTokenMinutes));
    }

    public string GenerateStaffAccessToken(Staff staff, Guid tenantId)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,  staff.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti,  Guid.NewGuid().ToString()),
            new Claim("name",       staff.DisplayName),
            new Claim("actor_type", "staff"),
            new Claim("tenant_id",  tenantId.ToString()),
            new Claim("role",       staff.Role.ToString().ToLowerInvariant()),
        };

        // Staff tokens are short-lived — 12 hours (shift length)
        return BuildToken(claims, TimeSpan.FromHours(12));
    }

    public (string Raw, string Hash) GenerateRefreshToken()
    {
        var raw  = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
        return (raw, hash);
    }

    public string HashRefreshToken(string raw) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));

    private string BuildToken(Claim[] claims, TimeSpan lifetime)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer:             _jwt.Issuer,
            audience:           _jwt.Audience,
            claims:             claims,
            expires:            DateTime.UtcNow.Add(lifetime),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
