namespace TabHub.API.API.Dtos;

public record CreateStaffRequest(string DisplayName, string Role, string Pin);

public record UpdateStaffRequest(string DisplayName, string Role, bool IsActive);

public record SetPinRequest(string Pin);

public record StaffDto(Guid Id, string DisplayName, string Role, bool IsActive);

public record CreateWaiterZoneRequest(Guid SpaceId, int ColStart, int ColEnd, int RowStart, int RowEnd);

public record WaiterZoneDto(Guid Id, Guid SpaceId, int ColStart, int ColEnd, int RowStart, int RowEnd);
