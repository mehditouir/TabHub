using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace TabHub.API.Infrastructure.Services;

public interface IImageStorageService
{
    /// <summary>
    /// Accepts any image file, resizes it to 400×400 WebP, stores it, and returns the public URL.
    /// Returns null if storage is not configured.
    /// </summary>
    Task<string?> StoreAsync(IFormFile file, string folder);
}

/// <summary>
/// Azure Blob Storage implementation — used when AzureStorage:ConnectionString is configured.
/// </summary>
public class BlobImageStorageService(IConfiguration config) : IImageStorageService
{
    public async Task<string?> StoreAsync(IFormFile file, string folder)
    {
        var connectionString = config["AzureStorage:ConnectionString"];
        var containerName    = config["AzureStorage:ContainerName"] ?? "tabhub-images";
        var cdnBase          = config["AzureStorage:CdnBaseUrl"]?.TrimEnd('/');

        if (string.IsNullOrWhiteSpace(connectionString)) return null;

        var webpBytes = await ResizeToWebpAsync(file);
        var blobName  = $"{folder}/{Guid.NewGuid():N}.webp";

        var client    = new BlobContainerClient(connectionString, containerName);
        await client.CreateIfNotExistsAsync(PublicAccessType.Blob);

        var blob = client.GetBlobClient(blobName);
        using var ms = new MemoryStream(webpBytes);
        await blob.UploadAsync(ms, new BlobHttpHeaders { ContentType = "image/webp" });

        return cdnBase is not null
            ? $"{cdnBase}/{blobName}"
            : blob.Uri.ToString();
    }

    private static async Task<byte[]> ResizeToWebpAsync(IFormFile file)
    {
        using var image = await Image.LoadAsync(file.OpenReadStream());

        // Crop to square from centre, then resize to 400×400
        var size = Math.Min(image.Width, image.Height);
        image.Mutate(x => x
            .Crop(new Rectangle((image.Width - size) / 2, (image.Height - size) / 2, size, size))
            .Resize(400, 400));

        using var ms = new MemoryStream();
        await image.SaveAsync(ms, new WebpEncoder { Quality = 82 });
        return ms.ToArray();
    }
}

/// <summary>
/// Local filesystem fallback — used in development when Azure is not configured.
/// Stores images in wwwroot/uploads/ and returns a relative URL.
/// </summary>
public class LocalImageStorageService(IWebHostEnvironment env, IHttpContextAccessor http) : IImageStorageService
{
    public async Task<string?> StoreAsync(IFormFile file, string folder)
    {
        var webpBytes = await ResizeToWebpAsync(file);
        var fileName  = $"{Guid.NewGuid():N}.webp";
        var dir       = Path.Combine(env.WebRootPath, "uploads", folder);

        Directory.CreateDirectory(dir);

        var filePath = Path.Combine(dir, fileName);
        await File.WriteAllBytesAsync(filePath, webpBytes);

        var req     = http.HttpContext!.Request;
        var baseUrl = $"{req.Scheme}://{req.Host}";
        return $"{baseUrl}/uploads/{folder}/{fileName}";
    }

    private static async Task<byte[]> ResizeToWebpAsync(IFormFile file)
    {
        using var image = await Image.LoadAsync(file.OpenReadStream());

        var size = Math.Min(image.Width, image.Height);
        image.Mutate(x => x
            .Crop(new Rectangle((image.Width - size) / 2, (image.Height - size) / 2, size, size))
            .Resize(400, 400));

        using var ms = new MemoryStream();
        await image.SaveAsync(ms, new WebpEncoder { Quality = 82 });
        return ms.ToArray();
    }
}
