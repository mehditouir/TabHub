namespace TabHub.API.Domain.Entities;

public class ModifierGroup
{
    public Guid     Id            { get; set; } = Guid.NewGuid();
    public Guid     MenuItemId    { get; set; }
    public string   Name          { get; set; } = string.Empty;
    public bool     IsRequired    { get; set; }
    public int      MinSelections { get; set; } = 0;
    public int      MaxSelections { get; set; } = 1;
    public int      SortOrder     { get; set; }

    public MenuItem                        MenuItem     { get; set; } = null!;
    public ICollection<ModifierGroupTranslation> Translations { get; set; } = [];
    public ICollection<ModifierOption>     Options      { get; set; } = [];
}
