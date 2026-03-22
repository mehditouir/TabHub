using BC = BCrypt.Net.BCrypt;

namespace TabHub.API.Infrastructure.Auth;

/// <summary>BCrypt hasher for staff PINs.</summary>
public class PinHasher
{
    public string Hash(string pin)   => BC.HashPassword(pin, workFactor: 10);
    public bool   Verify(string pin, string hash) => BC.Verify(pin, hash);
}
