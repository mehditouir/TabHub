namespace TabHub.API.Domain.Entities;

public class Config
{
    public string   Key       { get; set; } = string.Empty;
    public string   Value     { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
