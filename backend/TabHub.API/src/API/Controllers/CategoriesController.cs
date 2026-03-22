using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Services;

namespace TabHub.API.API.Controllers;

[Route("categories")]
public class CategoriesController(AppDbContext db, AuditService audit, ICurrentActor actor)
    : TenantControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.Categories
            .Include(c => c.Translations)
            .Select(c => ToDto(c))
            .ToListAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var category = await db.Categories.Include(c => c.Translations).FirstOrDefaultAsync(c => c.Id == id);
        return category is null ? NotFound() : Ok(ToDto(category));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCategoryRequest req)
    {
        var category = new Category
        {
            Name      = req.Name,
            SortOrder = req.SortOrder,
        };

        db.Categories.Add(category);
        await db.SaveChangesAsync();
        await audit.LogAsync("create", nameof(Category), category.Id.ToString(), actor, after: Snapshot(category));

        return Created($"/categories/{category.Id}", ToDto(category));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCategoryRequest req)
    {
        var category = await db.Categories.FindAsync(id);
        if (category is null) return NotFound();

        var before = Snapshot(category);
        category.Name      = req.Name;
        category.SortOrder = req.SortOrder;
        category.IsActive  = req.IsActive;
        category.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("update", nameof(Category), category.Id.ToString(), actor, before, after: Snapshot(category));

        return Ok(ToDto(category));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var category = await db.Categories.FindAsync(id);
        if (category is null) return NotFound();

        category.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await audit.LogAsync("delete", nameof(Category), category.Id.ToString(), actor, before: Snapshot(category));

        return NoContent();
    }

    [HttpPut("{id:guid}/translations/{language}")]
    public async Task<IActionResult> SetTranslation(Guid id, string language, [FromBody] SetCategoryTranslationRequest req)
    {
        if (!Enum.TryParse<Language>(language.ToUpper(), out var lang))
            return BadRequest(new { error = "Invalid language. Use FR, AR or EN." });

        var category = await db.Categories.FindAsync(id);
        if (category is null) return NotFound();

        var translation = await db.CategoryTranslations.FindAsync(id, lang);
        if (translation is null)
        {
            db.CategoryTranslations.Add(new CategoryTranslation { CategoryId = id, Language = lang, Name = req.Name });
        }
        else
        {
            translation.Name = req.Name;
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    private static CategoryDto ToDto(Category c) => new(
        c.Id, c.Name, c.SortOrder, c.IsActive,
        c.Translations.Select(t => new CategoryTranslationDto(t.Language.ToString(), t.Name)));

    private static object Snapshot(Category c) => new { c.Name, c.SortOrder, c.IsActive };
}
