using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class MenuItemTranslation
{
    public Guid     ItemId      { get; set; }
    public Language Language    { get; set; }
    public string   Name        { get; set; } = string.Empty;
    public string?  Description { get; set; }

    public MenuItem Item { get; set; } = null!;
}
