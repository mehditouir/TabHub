namespace TabHub.API.Domain.Entities;

public class Category
{
    public Guid      Id        { get; set; } = Guid.NewGuid();
    public string    Name      { get; set; } = string.Empty;
    public int       SortOrder { get; set; }
    public bool      IsActive  { get; set; } = true;
    public DateTime  CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime  UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt { get; set; }

    public ICollection<CategoryTranslation> Translations { get; set; } = [];
    public ICollection<MenuItem>            Items        { get; set; } = [];
}
