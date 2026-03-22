namespace TabHub.API.API.Dtos;

public record CreateTableRequest(Guid SpaceId, string Number, int Col, int Row);

public record UpdateTableRequest(string Number, int Col, int Row, bool IsActive);

public record TableDto(
    Guid   Id,
    Guid   SpaceId,
    string Number,
    int    Col,
    int    Row,
    Guid   QrToken,
    bool   IsActive);
