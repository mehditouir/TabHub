namespace TabHub.API.API.Dtos;

// ── Modifier groups ───────────────────────────────────────────────────────────

public record CreateModifierGroupRequest(
    Guid   MenuItemId,
    string Name,
    bool   IsRequired    = false,
    int    MinSelections = 0,
    int    MaxSelections = 1,
    int    SortOrder     = 0);

public record UpdateModifierGroupRequest(
    string Name,
    bool   IsRequired,
    int    MinSelections,
    int    MaxSelections,
    int    SortOrder);

public record SetModifierGroupTranslationRequest(string Name);

// ── Modifier options ──────────────────────────────────────────────────────────

public record CreateModifierOptionRequest(
    Guid    ModifierGroupId,
    string  Name,
    decimal PriceDelta  = 0,
    bool    IsAvailable = true,
    int     SortOrder   = 0);

public record UpdateModifierOptionRequest(
    string  Name,
    decimal PriceDelta,
    bool    IsAvailable,
    int     SortOrder);

public record SetModifierOptionTranslationRequest(string Name);

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record ModifierGroupTranslationDto(string Language, string Name);
public record ModifierOptionTranslationDto(string Language, string Name);

public record ModifierOptionDto(
    Guid    Id,
    Guid    ModifierGroupId,
    string  Name,
    decimal PriceDelta,
    bool    IsAvailable,
    int     SortOrder,
    IEnumerable<ModifierOptionTranslationDto> Translations);

public record ModifierGroupDto(
    Guid   Id,
    Guid   MenuItemId,
    string Name,
    bool   IsRequired,
    int    MinSelections,
    int    MaxSelections,
    int    SortOrder,
    IEnumerable<ModifierGroupTranslationDto> Translations,
    IEnumerable<ModifierOptionDto>           Options);
