namespace TabHub.API.Domain.Entities;

public class Manager
{
    public Guid     Id           { get; set; } = Guid.NewGuid();
    public string   Email        { get; set; } = string.Empty;
    public string   PasswordHash { get; set; } = string.Empty;
    public string   DisplayName  { get; set; } = string.Empty;
    public bool     IsSuperAdmin { get; set; }
    public bool     IsActive     { get; set; } = true;
    public DateTime CreatedAt    { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt    { get; set; } = DateTime.UtcNow;

    public ICollection<ManagerTenant> ManagerTenants { get; set; } = [];
    public ICollection<RefreshToken>  RefreshTokens  { get; set; } = [];
}
