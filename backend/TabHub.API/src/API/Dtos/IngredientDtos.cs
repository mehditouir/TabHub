namespace TabHub.API.API.Dtos;

public record CreateIngredientRequest(string Name);
public record UpdateIngredientRequest(string Name, bool IsActive);
public record SetIngredientTranslationRequest(string Name);

public record IngredientTranslationDto(string Language, string Name);

public record IngredientDto(
    Guid   Id,
    string Name,
    bool   IsActive,
    IEnumerable<IngredientTranslationDto> Translations);
