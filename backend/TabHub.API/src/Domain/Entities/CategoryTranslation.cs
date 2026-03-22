using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

public class CategoryTranslation
{
    public Guid     CategoryId { get; set; }
    public Language Language   { get; set; }
    public string   Name       { get; set; } = string.Empty;

    public Category Category { get; set; } = null!;
}
