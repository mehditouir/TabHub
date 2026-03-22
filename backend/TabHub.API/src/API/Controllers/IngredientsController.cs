using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Services;

namespace TabHub.API.API.Controllers;

[Route("ingredients")]
public class IngredientsController(AppDbContext db, AuditService audit, ICurrentActor actor)
    : TenantControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.Ingredients
            .Include(i => i.Translations)
            .Select(i => ToDto(i))
            .ToListAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var ingredient = await db.Ingredients.Include(i => i.Translations).FirstOrDefaultAsync(i => i.Id == id);
        return ingredient is null ? NotFound() : Ok(ToDto(ingredient));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateIngredientRequest req)
    {
        var ingredient = new Ingredient { Name = req.Name };

        db.Ingredients.Add(ingredient);
        await db.SaveChangesAsync();
        await audit.LogAsync("create", nameof(Ingredient), ingredient.Id.ToString(), actor, after: Snapshot(ingredient));

        return Created($"/ingredients/{ingredient.Id}", ToDto(ingredient));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateIngredientRequest req)
    {
        var ingredient = await db.Ingredients.FindAsync(id);
        if (ingredient is null) return NotFound();

        var before        = Snapshot(ingredient);
        var wasActive     = ingredient.IsActive;
        ingredient.Name      = req.Name;
        ingredient.IsActive  = req.IsActive;
        ingredient.UpdatedAt = DateTime.UtcNow;

        // Cascade-disable: when ingredient goes inactive, disable all items that use it
        if (wasActive && !req.IsActive)
        {
            var affectedItemIds = await db.MenuItemIngredients
                .Where(j => j.IngredientId == id)
                .Select(j => j.MenuItemId)
                .ToListAsync();

            if (affectedItemIds.Count > 0)
            {
                await db.MenuItems
                    .Where(i => affectedItemIds.Contains(i.Id))
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(i => i.IsAvailable, false)
                        .SetProperty(i => i.UpdatedAt, DateTime.UtcNow));
            }
        }

        await db.SaveChangesAsync();
        await audit.LogAsync("update", nameof(Ingredient), ingredient.Id.ToString(), actor, before, after: Snapshot(ingredient));

        return Ok(ToDto(ingredient));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ingredient = await db.Ingredients.FindAsync(id);
        if (ingredient is null) return NotFound();

        ingredient.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await audit.LogAsync("delete", nameof(Ingredient), ingredient.Id.ToString(), actor, before: Snapshot(ingredient));

        return NoContent();
    }

    [HttpPut("{id:guid}/translations/{language}")]
    public async Task<IActionResult> SetTranslation(Guid id, string language, [FromBody] SetIngredientTranslationRequest req)
    {
        if (!Enum.TryParse<Language>(language.ToUpper(), out var lang))
            return BadRequest(new { error = "Invalid language. Use FR, AR or EN." });

        var ingredient = await db.Ingredients.FindAsync(id);
        if (ingredient is null) return NotFound();

        var translation = await db.IngredientTranslations.FindAsync(id, lang);
        if (translation is null)
            db.IngredientTranslations.Add(new IngredientTranslation { IngredientId = id, Language = lang, Name = req.Name });
        else
            translation.Name = req.Name;

        await db.SaveChangesAsync();
        return NoContent();
    }

    // ── Ingredient ↔ menu item links ─────────────────────────────────────────

    [HttpPost("{id:guid}/menu-items/{menuItemId:guid}")]
    public async Task<IActionResult> LinkMenuItem(Guid id, Guid menuItemId)
    {
        if (await db.Ingredients.FindAsync(id) is null) return NotFound();
        if (await db.MenuItems.FindAsync(menuItemId) is null) return NotFound();

        var exists = await db.MenuItemIngredients.FindAsync(menuItemId, id);
        if (exists is not null) return Conflict(new { error = "Already linked." });

        db.MenuItemIngredients.Add(new MenuItemIngredient { MenuItemId = menuItemId, IngredientId = id });
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}/menu-items/{menuItemId:guid}")]
    public async Task<IActionResult> UnlinkMenuItem(Guid id, Guid menuItemId)
    {
        var link = await db.MenuItemIngredients.FindAsync(menuItemId, id);
        if (link is null) return NotFound();

        db.MenuItemIngredients.Remove(link);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static IngredientDto ToDto(Ingredient i) => new(
        i.Id, i.Name, i.IsActive,
        i.Translations.Select(t => new IngredientTranslationDto(t.Language.ToString(), t.Name)));

    private static object Snapshot(Ingredient i) => new { i.Name, i.IsActive };
}
