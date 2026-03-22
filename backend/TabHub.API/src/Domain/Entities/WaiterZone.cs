namespace TabHub.API.Domain.Entities;

public class WaiterZone
{
    public Guid     Id        { get; set; } = Guid.NewGuid();
    public Guid     StaffId   { get; set; }
    public Guid     SpaceId   { get; set; }
    public int      ColStart  { get; set; }
    public int      ColEnd    { get; set; }
    public int      RowStart  { get; set; }
    public int      RowEnd    { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Staff Staff { get; set; } = null!;
    public Space Space { get; set; } = null!;
}
