namespace TabHub.API.Domain.Entities;

/// <summary>Join table: many menu items ↔ many ingredients.</summary>
public class MenuItemIngredient
{
    public Guid MenuItemId   { get; set; }
    public Guid IngredientId { get; set; }

    public MenuItem    MenuItem   { get; set; } = null!;
    public Ingredient  Ingredient { get; set; } = null!;
}
