namespace TabHub.API.Domain.Entities;

public class RefreshToken
{
    public Guid      Id         { get; set; } = Guid.NewGuid();
    public Guid      ManagerId  { get; set; }
    public string    TokenHash  { get; set; } = string.Empty;
    public DateTime  ExpiresAt  { get; set; }
    public DateTime? RevokedAt  { get; set; }
    public DateTime  CreatedAt  { get; set; } = DateTime.UtcNow;

    public Manager Manager { get; set; } = null!;
}
