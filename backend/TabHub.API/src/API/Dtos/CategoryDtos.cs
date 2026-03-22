namespace TabHub.API.API.Dtos;

public record CreateCategoryRequest(string Name, int SortOrder = 0);
public record UpdateCategoryRequest(string Name, int SortOrder, bool IsActive);
public record SetCategoryTranslationRequest(string Name);

public record CategoryTranslationDto(string Language, string Name);

public record CategoryDto(
    Guid   Id,
    string Name,
    int    SortOrder,
    bool   IsActive,
    IEnumerable<CategoryTranslationDto> Translations);
