namespace TabHub.API.Domain.Entities;

public class Space
{
    public Guid      Id        { get; set; } = Guid.NewGuid();
    public string    Name      { get; set; } = string.Empty;
    public int       Cols      { get; set; }
    public int       Rows      { get; set; }
    public int       SortOrder { get; set; }
    public bool      IsActive  { get; set; } = true;
    public DateTime  CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime  UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt { get; set; }

    public ICollection<SpaceTranslation> Translations { get; set; } = [];
    public ICollection<RestaurantTable>  Tables       { get; set; } = [];
    public ICollection<WaiterZone>       WaiterZones  { get; set; } = [];
}
