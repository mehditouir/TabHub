using TabHub.API.Domain.Enums;

namespace TabHub.API.Domain.Entities;

/// <summary>
/// A schedule rule constrains when a Menu is active.
/// All rules for a menu are AND-combined: all must pass for the menu to be active.
/// If a menu has no rules, it is always active (when IsActive = true).
/// </summary>
public class MenuScheduleRule
{
    public Guid             Id       { get; set; } = Guid.NewGuid();
    public Guid             MenuId   { get; set; }
    public ScheduleRuleType RuleType { get; set; }

    // TIME_RANGE: active between TimeStart and TimeEnd every day (UTC)
    public TimeOnly? TimeStart { get; set; }
    public TimeOnly? TimeEnd   { get; set; }

    // DAY_OF_WEEK: bitmask — Monday=1, Tuesday=2, Wednesday=4, Thursday=8, Friday=16, Saturday=32, Sunday=64
    public int? DaysOfWeek { get; set; }

    // DATE_RANGE: active between DateStart and DateEnd (inclusive)
    public DateOnly? DateStart { get; set; }
    public DateOnly? DateEnd   { get; set; }

    public Menu Menu { get; set; } = null!;
}
