namespace TabHub.API.Domain.Entities;

public class RestaurantTable
{
    public Guid      Id        { get; set; } = Guid.NewGuid();
    public Guid      SpaceId   { get; set; }
    public string    Number    { get; set; } = string.Empty;
    public int       Col       { get; set; }
    public int       Row       { get; set; }
    public Guid      QrToken   { get; set; } = Guid.NewGuid();
    public bool      IsActive  { get; set; } = true;
    public DateTime  CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime  UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt { get; set; }

    public Space Space { get; set; } = null!;
}
