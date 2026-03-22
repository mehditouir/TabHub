namespace TabHub.API.Domain.Entities;

/// <summary>Join table: a Menu groups one or more Categories.</summary>
public class MenuCategory
{
    public Guid MenuId     { get; set; }
    public Guid CategoryId { get; set; }

    public Menu     Menu     { get; set; } = null!;
    public Category Category { get; set; } = null!;
}
