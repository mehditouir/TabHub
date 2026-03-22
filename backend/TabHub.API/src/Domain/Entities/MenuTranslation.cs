using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class MenuTranslation
{
    public Guid     MenuId   { get; set; }
    public Language Language { get; set; }
    public string   Name     { get; set; } = string.Empty;

    public Menu Menu { get; set; } = null!;
}
