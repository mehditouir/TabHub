using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class SpaceTranslation
{
    public Guid     SpaceId  { get; set; }
    public Language Language { get; set; }
    public string   Name     { get; set; } = string.Empty;

    public Space Space { get; set; } = null!;
}
