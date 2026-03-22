using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Services;

namespace TabHub.API.API.Controllers;

[Route("spaces")]
public class SpacesController(AppDbContext db, AuditService audit, ICurrentActor actor)
    : TenantControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.Spaces
            .Include(s => s.Translations)
            .Select(s => ToDto(s))
            .ToListAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var space = await db.Spaces.Include(s => s.Translations).FirstOrDefaultAsync(s => s.Id == id);
        return space is null ? NotFound() : Ok(ToDto(space));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSpaceRequest req)
    {
        var space = new Space
        {
            Name      = req.Name,
            Cols      = req.Cols,
            Rows      = req.Rows,
            SortOrder = req.SortOrder,
        };

        db.Spaces.Add(space);
        await db.SaveChangesAsync();
        await audit.LogAsync("create", nameof(Space), space.Id.ToString(), actor, after: space);

        return Created($"/spaces/{space.Id}", ToDto(space));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSpaceRequest req)
    {
        var space = await db.Spaces.FindAsync(id);
        if (space is null) return NotFound();

        var before = Snapshot(space);
        space.Name      = req.Name;
        space.Cols      = req.Cols;
        space.Rows      = req.Rows;
        space.SortOrder = req.SortOrder;
        space.IsActive  = req.IsActive;
        space.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("update", nameof(Space), space.Id.ToString(), actor, before, after: Snapshot(space));

        return Ok(ToDto(space));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var space = await db.Spaces.FindAsync(id);
        if (space is null) return NotFound();

        space.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await audit.LogAsync("delete", nameof(Space), space.Id.ToString(), actor, before: Snapshot(space));

        return NoContent();
    }

    [HttpPut("{id:guid}/translations/{language}")]
    public async Task<IActionResult> SetTranslation(Guid id, string language, [FromBody] SetTranslationRequest req)
    {
        if (!Enum.TryParse<Language>(language.ToUpper(), out var lang))
            return BadRequest(new { error = "Invalid language. Use FR, AR or EN." });

        var space = await db.Spaces.FindAsync(id);
        if (space is null) return NotFound();

        var translation = await db.SpaceTranslations.FindAsync(id, lang);
        if (translation is null)
        {
            db.SpaceTranslations.Add(new SpaceTranslation { SpaceId = id, Language = lang, Name = req.Name });
        }
        else
        {
            translation.Name = req.Name;
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    private static SpaceDto ToDto(Space s) => new(
        s.Id, s.Name, s.Cols, s.Rows, s.SortOrder, s.IsActive,
        s.Translations.Select(t => new SpaceTranslationDto(t.Language.ToString(), t.Name)));

    private static object Snapshot(Space s) => new { s.Name, s.Cols, s.Rows, s.SortOrder, s.IsActive };
}
