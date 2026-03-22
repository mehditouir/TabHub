namespace TabHub.API.Domain.Entities;

public class ModifierOption
{
    public Guid     Id              { get; set; } = Guid.NewGuid();
    public Guid     ModifierGroupId { get; set; }
    public string   Name            { get; set; } = string.Empty;
    public decimal  PriceDelta      { get; set; } = 0;
    public bool     IsAvailable     { get; set; } = true;
    public int      SortOrder       { get; set; }

    public ModifierGroup                        ModifierGroup { get; set; } = null!;
    public ICollection<ModifierOptionTranslation> Translations  { get; set; } = [];
}
