namespace TabHub.API.API.Dtos;

public record CreateSpaceRequest(string Name, int Cols, int Rows, int SortOrder = 0);

public record UpdateSpaceRequest(string Name, int Cols, int Rows, int SortOrder, bool IsActive);

public record SetTranslationRequest(string Name);

public record SpaceTranslationDto(string Language, string Name);

public record SpaceDto(
    Guid   Id,
    string Name,
    int    Cols,
    int    Rows,
    int    SortOrder,
    bool   IsActive,
    IEnumerable<SpaceTranslationDto> Translations);
