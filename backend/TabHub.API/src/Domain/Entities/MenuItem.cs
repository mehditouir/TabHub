namespace TabHub.API.Domain.Entities;

public class MenuItem
{
    public Guid      Id          { get; set; } = Guid.NewGuid();
    public Guid      CategoryId  { get; set; }
    public string    Name        { get; set; } = string.Empty;
    public string?   Description { get; set; }
    public decimal   Price       { get; set; }
    public string?   ImageUrl    { get; set; }
    public bool      IsAvailable { get; set; } = true;
    public int       SortOrder   { get; set; }
    public DateTime  CreatedAt   { get; set; } = DateTime.UtcNow;
    public DateTime  UpdatedAt   { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt   { get; set; }

    public Category                         Category       { get; set; } = null!;
    public ICollection<MenuItemTranslation> Translations   { get; set; } = [];
    public ICollection<MenuItemIngredient>  Ingredients    { get; set; } = [];
    public ICollection<ModifierGroup>       ModifierGroups { get; set; } = [];
}
