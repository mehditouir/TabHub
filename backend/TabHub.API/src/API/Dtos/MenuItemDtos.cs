namespace TabHub.API.API.Dtos;

public record CreateMenuItemRequest(
    Guid    CategoryId,
    string  Name,
    decimal Price,
    string? Description = null,
    string? ImageUrl    = null,
    int     SortOrder   = 0);

public record UpdateMenuItemRequest(
    Guid    CategoryId,
    string  Name,
    decimal Price,
    bool    IsAvailable,
    string? Description = null,
    string? ImageUrl    = null,
    int     SortOrder   = 0);

public record SetMenuItemTranslationRequest(string Name, string? Description = null);

public record MenuItemTranslationDto(string Language, string Name, string? Description);

public record MenuItemDto(
    Guid    Id,
    Guid    CategoryId,
    string  Name,
    decimal Price,
    bool    IsAvailable,
    int     SortOrder,
    string? Description,
    string? ImageUrl,
    IEnumerable<MenuItemTranslationDto> Translations);

// Public menu response (no auth required)
public record PublicModifierOptionDto(
    Guid    Id,
    string  Name,
    decimal PriceDelta,
    IEnumerable<ModifierOptionTranslationDto> Translations);

public record PublicModifierGroupDto(
    Guid   Id,
    string Name,
    bool   IsRequired,
    int    MinSelections,
    int    MaxSelections,
    IEnumerable<ModifierGroupTranslationDto> Translations,
    IEnumerable<PublicModifierOptionDto>     Options);

public record PublicMenuItemDto(
    Guid    Id,
    string  Name,
    decimal Price,
    bool    IsAvailable,
    int     SortOrder,
    string? Description,
    string? ImageUrl,
    IEnumerable<MenuItemTranslationDto>  Translations,
    IEnumerable<PublicModifierGroupDto>  ModifierGroups);

public record PublicCategoryDto(
    Guid   Id,
    string Name,
    int    SortOrder,
    IEnumerable<CategoryTranslationDto> Translations,
    IEnumerable<PublicMenuItemDto>      Items);

public record PublicMenuResponse(
    string Tenant,
    IEnumerable<PublicCategoryDto> Categories);
