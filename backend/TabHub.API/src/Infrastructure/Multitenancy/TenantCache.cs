using Microsoft.Extensions.Caching.Memory;

namespace TabHub.API.Infrastructure.Multitenancy;

public class TenantCache(IMemoryCache cache)
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);

    public TenantContext? Get(string slug) =>
        cache.TryGetValue(CacheKey(slug), out TenantContext? ctx) ? ctx : null;

    public void Set(string slug, TenantContext ctx) =>
        cache.Set(CacheKey(slug), ctx, Ttl);

    private static string CacheKey(string slug) => $"tenant:{slug}";
}
