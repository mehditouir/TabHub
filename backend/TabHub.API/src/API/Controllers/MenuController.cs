using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Infrastructure.Multitenancy;
using TabHub.API.Infrastructure.Persistence;

namespace TabHub.API.API.Controllers;

/// <summary>
/// Public menu endpoint — no authentication required.
/// Returns all active categories and their available menu items.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("menu")]
public class MenuController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetMenu()
    {
        var tenantCtx = HttpContext.Items[nameof(TenantContext)] as TenantContext;
        if (tenantCtx is null) return BadRequest(new { error = "Unable to resolve tenant." });

        var categories = await db.Categories
            .Where(c => c.IsActive)
            .Include(c => c.Translations)
            .Include(c => c.Items.Where(i => i.IsAvailable && i.DeletedAt == null))
                .ThenInclude(i => i.Translations)
            .Include(c => c.Items.Where(i => i.IsAvailable && i.DeletedAt == null))
                .ThenInclude(i => i.ModifierGroups)
                    .ThenInclude(g => g.Translations)
            .Include(c => c.Items.Where(i => i.IsAvailable && i.DeletedAt == null))
                .ThenInclude(i => i.ModifierGroups)
                    .ThenInclude(g => g.Options)
                        .ThenInclude(o => o.Translations)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        var response = new PublicMenuResponse(
            tenantCtx.Slug,
            categories.Select(c => new PublicCategoryDto(
                c.Id,
                c.Name,
                c.SortOrder,
                c.Translations.Select(t => new CategoryTranslationDto(t.Language.ToString(), t.Name)),
                c.Items
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new PublicMenuItemDto(
                        i.Id, i.Name, i.Price, i.IsAvailable, i.SortOrder,
                        i.Description, i.ImageUrl,
                        i.Translations.Select(t => new MenuItemTranslationDto(t.Language.ToString(), t.Name, t.Description)),
                        i.ModifierGroups
                            .OrderBy(g => g.SortOrder)
                            .Select(g => new PublicModifierGroupDto(
                                g.Id, g.Name, g.IsRequired, g.MinSelections, g.MaxSelections,
                                g.Translations.Select(t => new ModifierGroupTranslationDto(t.Language.ToString(), t.Name)),
                                g.Options
                                    .Where(o => o.IsAvailable)
                                    .OrderBy(o => o.SortOrder)
                                    .Select(o => new PublicModifierOptionDto(
                                        o.Id, o.Name, o.PriceDelta,
                                        o.Translations.Select(t => new ModifierOptionTranslationDto(t.Language.ToString(), t.Name))))))))
            ))
        );

        return Ok(response);
    }
}
