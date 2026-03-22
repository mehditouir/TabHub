using System.Security.Cryptography;
using Konscious.Security.Cryptography;

namespace TabHub.API.Infrastructure.Auth;

/// <summary>
/// Argon2id hasher for manager passwords.
/// Format stored in DB: "v1:{Base64(salt)}:{Base64(hash)}"
/// </summary>
public class ArgonHasher
{
    private const int SaltBytes   = 16;
    private const int HashBytes   = 32;
    private const int Parallelism = 1;
    private const int MemoryKb    = 65536;
    private const int Iterations  = 3;

    public string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = ComputeHash(password, salt);
        return $"v1:{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    public bool Verify(string password, string encoded)
    {
        var parts = encoded.Split(':');
        if (parts.Length != 3 || parts[0] != "v1") return false;

        var salt = Convert.FromBase64String(parts[1]);
        var expected = Convert.FromBase64String(parts[2]);
        var actual   = ComputeHash(password, salt);

        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    private static byte[] ComputeHash(string password, byte[] salt)
    {
        using var argon2 = new Argon2id(System.Text.Encoding.UTF8.GetBytes(password))
        {
            Salt        = salt,
            DegreeOfParallelism = Parallelism,
            MemorySize  = MemoryKb,
            Iterations  = Iterations,
        };
        return argon2.GetBytes(HashBytes);
    }
}
