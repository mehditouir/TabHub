using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Services;

namespace TabHub.API.API.Controllers;

[Route("modifier-groups")]
public class ModifierGroupsController(AppDbContext db, AuditService audit, ICurrentActor actor)
    : TenantControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid? menuItemId)
    {
        var query = db.ModifierGroups
            .Include(g => g.Translations)
            .Include(g => g.Options)
                .ThenInclude(o => o.Translations)
            .AsQueryable();

        if (menuItemId.HasValue)
            query = query.Where(g => g.MenuItemId == menuItemId.Value);

        return Ok(await query.OrderBy(g => g.SortOrder).Select(g => ToDto(g)).ToListAsync());
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var group = await db.ModifierGroups
            .Include(g => g.Translations)
            .Include(g => g.Options).ThenInclude(o => o.Translations)
            .FirstOrDefaultAsync(g => g.Id == id);
        return group is null ? NotFound() : Ok(ToDto(group));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateModifierGroupRequest req)
    {
        if (await db.MenuItems.FindAsync(req.MenuItemId) is null)
            return BadRequest(new { error = "MenuItem not found." });

        var group = new ModifierGroup
        {
            MenuItemId    = req.MenuItemId,
            Name          = req.Name,
            IsRequired    = req.IsRequired,
            MinSelections = req.MinSelections,
            MaxSelections = req.MaxSelections,
            SortOrder     = req.SortOrder,
        };
        db.ModifierGroups.Add(group);
        await db.SaveChangesAsync();
        await audit.LogAsync("create", nameof(ModifierGroup), group.Id.ToString(), actor, after: GroupSnapshot(group));
        return Created($"/modifier-groups/{group.Id}", ToDto(group));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateModifierGroupRequest req)
    {
        var group = await db.ModifierGroups.Include(g => g.Options).ThenInclude(o => o.Translations)
            .Include(g => g.Translations).FirstOrDefaultAsync(g => g.Id == id);
        if (group is null) return NotFound();

        var before          = GroupSnapshot(group);
        group.Name          = req.Name;
        group.IsRequired    = req.IsRequired;
        group.MinSelections = req.MinSelections;
        group.MaxSelections = req.MaxSelections;
        group.SortOrder     = req.SortOrder;

        await db.SaveChangesAsync();
        await audit.LogAsync("update", nameof(ModifierGroup), group.Id.ToString(), actor, before, after: GroupSnapshot(group));
        return Ok(ToDto(group));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var group = await db.ModifierGroups.FindAsync(id);
        if (group is null) return NotFound();

        db.ModifierGroups.Remove(group);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:guid}/translations/{language}")]
    public async Task<IActionResult> SetTranslation(Guid id, string language, [FromBody] SetModifierGroupTranslationRequest req)
    {
        if (!Enum.TryParse<Language>(language.ToUpper(), out var lang))
            return BadRequest(new { error = "Invalid language. Use FR, AR or EN." });

        if (await db.ModifierGroups.FindAsync(id) is null) return NotFound();

        var t = await db.ModifierGroupTranslations.FindAsync(id, lang);
        if (t is null)
            db.ModifierGroupTranslations.Add(new ModifierGroupTranslation { ModifierGroupId = id, Language = lang, Name = req.Name });
        else
            t.Name = req.Name;

        await db.SaveChangesAsync();
        return NoContent();
    }

    private static ModifierGroupDto ToDto(ModifierGroup g) => new(
        g.Id, g.MenuItemId, g.Name, g.IsRequired, g.MinSelections, g.MaxSelections, g.SortOrder,
        g.Translations.Select(t => new ModifierGroupTranslationDto(t.Language.ToString(), t.Name)),
        g.Options.OrderBy(o => o.SortOrder).Select(OptionDto));

    private static ModifierOptionDto OptionDto(ModifierOption o) => new(
        o.Id, o.ModifierGroupId, o.Name, o.PriceDelta, o.IsAvailable, o.SortOrder,
        o.Translations.Select(t => new ModifierOptionTranslationDto(t.Language.ToString(), t.Name)));

    private static object GroupSnapshot(ModifierGroup g) =>
        new { g.Name, g.IsRequired, g.MinSelections, g.MaxSelections, g.SortOrder };
}

[Route("modifier-options")]
public class ModifierOptionsController(AppDbContext db, AuditService audit, ICurrentActor actor)
    : TenantControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateModifierOptionRequest req)
    {
        if (await db.ModifierGroups.FindAsync(req.ModifierGroupId) is null)
            return BadRequest(new { error = "ModifierGroup not found." });

        var option = new ModifierOption
        {
            ModifierGroupId = req.ModifierGroupId,
            Name            = req.Name,
            PriceDelta      = req.PriceDelta,
            IsAvailable     = req.IsAvailable,
            SortOrder       = req.SortOrder,
        };
        db.ModifierOptions.Add(option);
        await db.SaveChangesAsync();
        await audit.LogAsync("create", nameof(ModifierOption), option.Id.ToString(), actor, after: OptionSnapshot(option));
        return Created($"/modifier-options/{option.Id}", ToDto(option));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateModifierOptionRequest req)
    {
        var option = await db.ModifierOptions.Include(o => o.Translations).FirstOrDefaultAsync(o => o.Id == id);
        if (option is null) return NotFound();

        var before          = OptionSnapshot(option);
        option.Name         = req.Name;
        option.PriceDelta   = req.PriceDelta;
        option.IsAvailable  = req.IsAvailable;
        option.SortOrder    = req.SortOrder;

        await db.SaveChangesAsync();
        await audit.LogAsync("update", nameof(ModifierOption), option.Id.ToString(), actor, before, after: OptionSnapshot(option));
        return Ok(ToDto(option));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var option = await db.ModifierOptions.FindAsync(id);
        if (option is null) return NotFound();

        db.ModifierOptions.Remove(option);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:guid}/translations/{language}")]
    public async Task<IActionResult> SetTranslation(Guid id, string language, [FromBody] SetModifierOptionTranslationRequest req)
    {
        if (!Enum.TryParse<Language>(language.ToUpper(), out var lang))
            return BadRequest(new { error = "Invalid language. Use FR, AR or EN." });

        if (await db.ModifierOptions.FindAsync(id) is null) return NotFound();

        var t = await db.ModifierOptionTranslations.FindAsync(id, lang);
        if (t is null)
            db.ModifierOptionTranslations.Add(new ModifierOptionTranslation { ModifierOptionId = id, Language = lang, Name = req.Name });
        else
            t.Name = req.Name;

        await db.SaveChangesAsync();
        return NoContent();
    }

    private static ModifierOptionDto ToDto(ModifierOption o) => new(
        o.Id, o.ModifierGroupId, o.Name, o.PriceDelta, o.IsAvailable, o.SortOrder,
        o.Translations.Select(t => new ModifierOptionTranslationDto(t.Language.ToString(), t.Name)));

    private static object OptionSnapshot(ModifierOption o) =>
        new { o.Name, o.PriceDelta, o.IsAvailable, o.SortOrder };
}
