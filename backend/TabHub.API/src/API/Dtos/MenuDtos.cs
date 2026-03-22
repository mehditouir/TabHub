namespace TabHub.API.API.Dtos;

// ── Menus ────────────────────────────────────────────────────────────────────

public record CreateMenuRequest(string Name, int SortOrder = 0);
public record UpdateMenuRequest(string Name, int SortOrder, bool IsActive);
public record SetMenuTranslationRequest(string Name);

// ── Schedule rules ───────────────────────────────────────────────────────────

/// <param name="RuleType">TimeRange | DayOfWeek | DateRange</param>
/// <param name="TimeStart">HH:mm — required for TimeRange</param>
/// <param name="TimeEnd">HH:mm — required for TimeRange</param>
/// <param name="DaysOfWeek">Bitmask: Mon=1,Tue=2,Wed=4,Thu=8,Fri=16,Sat=32,Sun=64 — required for DayOfWeek</param>
/// <param name="DateStart">yyyy-MM-dd — required for DateRange</param>
/// <param name="DateEnd">yyyy-MM-dd — required for DateRange</param>
public record CreateScheduleRuleRequest(
    string  RuleType,
    string? TimeStart  = null,
    string? TimeEnd    = null,
    int?    DaysOfWeek = null,
    string? DateStart  = null,
    string? DateEnd    = null);

public record MenuTranslationDto(string Language, string Name);

public record ScheduleRuleDto(
    Guid    Id,
    string  RuleType,
    string? TimeStart,
    string? TimeEnd,
    int?    DaysOfWeek,
    string? DateStart,
    string? DateEnd);

public record MenuDto(
    Guid   Id,
    string Name,
    bool   IsActive,
    int    SortOrder,
    IEnumerable<MenuTranslationDto>  Translations,
    IEnumerable<ScheduleRuleDto>     ScheduleRules,
    IEnumerable<Guid>                CategoryIds);

// ── Active menu response (public, schedule-filtered) ─────────────────────────

public record ActiveMenuResponse(
    string Tenant,
    IEnumerable<ActiveMenuDto> Menus);

public record ActiveMenuDto(
    Guid   Id,
    string Name,
    int    SortOrder,
    IEnumerable<MenuTranslationDto>   Translations,
    IEnumerable<PublicCategoryDto>    Categories);
