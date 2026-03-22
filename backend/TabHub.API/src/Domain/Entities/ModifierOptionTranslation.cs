using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class ModifierOptionTranslation
{
    public Guid     ModifierOptionId { get; set; }
    public Language Language         { get; set; }
    public string   Name             { get; set; } = string.Empty;

    public ModifierOption ModifierOption { get; set; } = null!;
}
