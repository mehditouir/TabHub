using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class IngredientTranslation
{
    public Guid     IngredientId { get; set; }
    public Language Language     { get; set; }
    public string   Name         { get; set; } = string.Empty;

    public Ingredient Ingredient { get; set; } = null!;
}
