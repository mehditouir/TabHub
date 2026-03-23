namespace TabHub.API.API.Dtos;

public record RegisterManagerRequest(string Email, string Password, string DisplayName);

// Super admin DTOs
public record CreateTenantRequest(string Slug, string Name);
public record AdminCreateManagerRequest(string Email, string Password, string DisplayName, Guid? TenantId);
public record AssignManagerRequest(Guid ManagerId, string Role);

public record LoginRequest(string Email, string Password);

public record StaffPinLoginRequest(string Pin);

public record LoginResponse(
    string AccessToken,
    DateTime ExpiresAt,
    string ManagerId,
    string DisplayName,
    string Email,
    string Role);

public record StaffLoginResponse(
    string AccessToken,
    DateTime ExpiresAt,
    string StaffId,
    string DisplayName,
    string Role);
