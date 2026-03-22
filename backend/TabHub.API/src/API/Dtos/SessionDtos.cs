namespace TabHub.API.API.Dtos;

public record OpenSessionRequest(Guid TableId, string? Notes = null);

public record MoveSessionRequest(Guid NewTableId);

public record MergeSessionRequest(Guid SourceSessionId);

public record SessionDto(
    Guid      Id,
    Guid      TableId,
    string    TableNumber,
    Guid?     StaffId,
    string?   StaffName,
    bool      IsOpen,
    DateTime  OpenedAt,
    DateTime? ClosedAt,
    string?   Notes,
    int       OrderCount);
