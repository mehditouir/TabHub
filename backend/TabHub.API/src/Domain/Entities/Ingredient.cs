namespace TabHub.API.Domain.Entities;

public class Ingredient
{
    public Guid      Id        { get; set; } = Guid.NewGuid();
    public string    Name      { get; set; } = string.Empty;
    public bool      IsActive  { get; set; } = true;
    public DateTime  CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime  UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt { get; set; }

    public ICollection<IngredientTranslation> Translations { get; set; } = [];
    public ICollection<MenuItemIngredient>    MenuItems    { get; set; } = [];
}
