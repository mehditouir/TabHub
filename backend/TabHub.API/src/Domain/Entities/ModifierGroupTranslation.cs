using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class ModifierGroupTranslation
{
    public Guid     ModifierGroupId { get; set; }
    public Language Language        { get; set; }
    public string   Name            { get; set; } = string.Empty;

    public ModifierGroup ModifierGroup { get; set; } = null!;
}
