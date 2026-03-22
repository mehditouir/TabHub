namespace TabHub.API.API.Dtos;

public record RegisterManagerRequest(string Email, string Password, string DisplayName);

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
