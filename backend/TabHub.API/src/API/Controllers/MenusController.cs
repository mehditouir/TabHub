using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Multitenancy;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Services;

namespace TabHub.API.API.Controllers;

[Route("menus")]
public class MenusController(AppDbContext db, AuditService audit, ICurrentActor actor)
    : TenantControllerBase
{
    // ── Manager CRUD ─────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.Menus
            .Include(m => m.Translations)
            .Include(m => m.ScheduleRules)
            .Include(m => m.MenuCategories)
            .Select(m => ToDto(m))
            .ToListAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var menu = await db.Menus
            .Include(m => m.Translations)
            .Include(m => m.ScheduleRules)
            .Include(m => m.MenuCategories)
            .FirstOrDefaultAsync(m => m.Id == id);
        return menu is null ? NotFound() : Ok(ToDto(menu));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMenuRequest req)
    {
        var menu = new Menu { Name = req.Name, SortOrder = req.SortOrder };
        db.Menus.Add(menu);
        await db.SaveChangesAsync();
        await audit.LogAsync("create", nameof(Menu), menu.Id.ToString(), actor, after: Snapshot(menu));
        return Created($"/menus/{menu.Id}", ToDto(menu));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateMenuRequest req)
    {
        var menu = await db.Menus.FindAsync(id);
        if (menu is null) return NotFound();

        var before     = Snapshot(menu);
        menu.Name      = req.Name;
        menu.SortOrder = req.SortOrder;
        menu.IsActive  = req.IsActive;
        menu.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("update", nameof(Menu), menu.Id.ToString(), actor, before, after: Snapshot(menu));
        return Ok(ToDto(menu));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var menu = await db.Menus.FindAsync(id);
        if (menu is null) return NotFound();

        menu.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await audit.LogAsync("delete", nameof(Menu), menu.Id.ToString(), actor, before: Snapshot(menu));
        return NoContent();
    }

    // ── Translations ─────────────────────────────────────────────────────────

    [HttpPut("{id:guid}/translations/{language}")]
    public async Task<IActionResult> SetTranslation(Guid id, string language, [FromBody] SetMenuTranslationRequest req)
    {
        if (!Enum.TryParse<Language>(language.ToUpper(), out var lang))
            return BadRequest(new { error = "Invalid language. Use FR, AR or EN." });

        if (await db.Menus.FindAsync(id) is null) return NotFound();

        var translation = await db.MenuTranslations.FindAsync(id, lang);
        if (translation is null)
            db.MenuTranslations.Add(new MenuTranslation { MenuId = id, Language = lang, Name = req.Name });
        else
            translation.Name = req.Name;

        await db.SaveChangesAsync();
        return NoContent();
    }

    // ── Schedule rules ────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/rules")]
    public async Task<IActionResult> AddRule(Guid id, [FromBody] CreateScheduleRuleRequest req)
    {
        if (await db.Menus.FindAsync(id) is null) return NotFound();

        if (!Enum.TryParse<ScheduleRuleType>(req.RuleType, true, out var ruleType))
            return BadRequest(new { error = "Invalid ruleType. Use TimeRange, DayOfWeek, or DateRange." });

        var rule = new MenuScheduleRule { MenuId = id, RuleType = ruleType };

        switch (ruleType)
        {
            case ScheduleRuleType.TimeRange:
                if (!TimeOnly.TryParse(req.TimeStart, out var ts) || !TimeOnly.TryParse(req.TimeEnd, out var te))
                    return BadRequest(new { error = "TimeRange requires timeStart and timeEnd in HH:mm format." });
                rule.TimeStart = ts;
                rule.TimeEnd   = te;
                break;

            case ScheduleRuleType.DayOfWeek:
                if (req.DaysOfWeek is null)
                    return BadRequest(new { error = "DayOfWeek rule requires daysOfWeek bitmask (Mon=1,Tue=2,Wed=4,Thu=8,Fri=16,Sat=32,Sun=64)." });
                rule.DaysOfWeek = req.DaysOfWeek;
                break;

            case ScheduleRuleType.DateRange:
                if (!DateOnly.TryParse(req.DateStart, out var ds) || !DateOnly.TryParse(req.DateEnd, out var de))
                    return BadRequest(new { error = "DateRange requires dateStart and dateEnd in yyyy-MM-dd format." });
                rule.DateStart = ds;
                rule.DateEnd   = de;
                break;
        }

        db.MenuScheduleRules.Add(rule);
        await db.SaveChangesAsync();
        return Created($"/menus/{id}/rules/{rule.Id}", ToRuleDto(rule));
    }

    [HttpDelete("{id:guid}/rules/{ruleId:guid}")]
    public async Task<IActionResult> DeleteRule(Guid id, Guid ruleId)
    {
        var rule = await db.MenuScheduleRules.FirstOrDefaultAsync(r => r.Id == ruleId && r.MenuId == id);
        if (rule is null) return NotFound();

        db.MenuScheduleRules.Remove(rule);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ── Category assignments ──────────────────────────────────────────────────

    [HttpPost("{id:guid}/categories/{categoryId:guid}")]
    public async Task<IActionResult> AddCategory(Guid id, Guid categoryId)
    {
        if (await db.Menus.FindAsync(id) is null) return NotFound();
        if (await db.Categories.FindAsync(categoryId) is null) return NotFound();

        var exists = await db.MenuCategories.FindAsync(id, categoryId);
        if (exists is not null) return Conflict(new { error = "Category already in this menu." });

        db.MenuCategories.Add(new MenuCategory { MenuId = id, CategoryId = categoryId });
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}/categories/{categoryId:guid}")]
    public async Task<IActionResult> RemoveCategory(Guid id, Guid categoryId)
    {
        var link = await db.MenuCategories.FindAsync(id, categoryId);
        if (link is null) return NotFound();

        db.MenuCategories.Remove(link);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ── Public: GET /menus/active (schedule-filtered) ─────────────────────────

    [HttpGet("active")]
    [AllowAnonymous]
    public async Task<IActionResult> GetActive()
    {
        var tenantCtx = HttpContext.Items[nameof(TenantContext)] as TenantContext;
        if (tenantCtx is null) return BadRequest(new { error = "Unable to resolve tenant." });

        var now = DateTime.UtcNow;

        var menus = await db.Menus
            .Where(m => m.IsActive)
            .Include(m => m.Translations)
            .Include(m => m.ScheduleRules)
            .Include(m => m.MenuCategories)
                .ThenInclude(mc => mc.Category)
                    .ThenInclude(c => c.Translations)
            .Include(m => m.MenuCategories)
                .ThenInclude(mc => mc.Category)
                    .ThenInclude(c => c.Items.Where(i => i.IsAvailable && i.DeletedAt == null))
                        .ThenInclude(i => i.Translations)
            .Include(m => m.MenuCategories)
                .ThenInclude(mc => mc.Category)
                    .ThenInclude(c => c.Items.Where(i => i.IsAvailable && i.DeletedAt == null))
                        .ThenInclude(i => i.ModifierGroups)
                            .ThenInclude(g => g.Translations)
            .Include(m => m.MenuCategories)
                .ThenInclude(mc => mc.Category)
                    .ThenInclude(c => c.Items.Where(i => i.IsAvailable && i.DeletedAt == null))
                        .ThenInclude(i => i.ModifierGroups)
                            .ThenInclude(g => g.Options)
                                .ThenInclude(o => o.Translations)
            .OrderBy(m => m.SortOrder)
            .ToListAsync();

        var activeMenus = menus.Where(m => IsScheduleActive(m, now)).ToList();

        var response = new ActiveMenuResponse(
            tenantCtx.Slug,
            activeMenus.Select(m => new ActiveMenuDto(
                m.Id, m.Name, m.SortOrder,
                m.Translations.Select(t => new MenuTranslationDto(t.Language.ToString(), t.Name)),
                m.MenuCategories
                    .OrderBy(mc => mc.Category.SortOrder)
                    .Select(mc => mc.Category)
                    .Where(c => c.IsActive)
                    .Select(c => new PublicCategoryDto(
                        c.Id, c.Name, c.SortOrder,
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
            ))
        );

        return Ok(response);
    }

    // ── Scheduling engine ─────────────────────────────────────────────────────

    private static bool IsScheduleActive(Menu menu, DateTime utcNow)
    {
        if (!menu.ScheduleRules.Any()) return true; // no rules → always active

        return menu.ScheduleRules.All(rule => EvaluateRule(rule, utcNow));
    }

    private static bool EvaluateRule(MenuScheduleRule rule, DateTime utcNow) => rule.RuleType switch
    {
        ScheduleRuleType.TimeRange => rule.TimeStart.HasValue && rule.TimeEnd.HasValue &&
            EvaluateTimeRange(TimeOnly.FromDateTime(utcNow), rule.TimeStart.Value, rule.TimeEnd.Value),

        ScheduleRuleType.DayOfWeek => rule.DaysOfWeek.HasValue &&
            (rule.DaysOfWeek.Value & DayOfWeekBit(utcNow.DayOfWeek)) != 0,

        ScheduleRuleType.DateRange => rule.DateStart.HasValue && rule.DateEnd.HasValue &&
            DateOnly.FromDateTime(utcNow) >= rule.DateStart.Value &&
            DateOnly.FromDateTime(utcNow) <= rule.DateEnd.Value,

        _ => false,
    };

    private static bool EvaluateTimeRange(TimeOnly now, TimeOnly start, TimeOnly end) =>
        start <= end
            ? now >= start && now <= end             // same day: 09:00–17:00
            : now >= start || now <= end;            // crosses midnight: 22:00–06:00

    private static int DayOfWeekBit(DayOfWeek day) => day switch
    {
        DayOfWeek.Monday    => 1,
        DayOfWeek.Tuesday   => 2,
        DayOfWeek.Wednesday => 4,
        DayOfWeek.Thursday  => 8,
        DayOfWeek.Friday    => 16,
        DayOfWeek.Saturday  => 32,
        DayOfWeek.Sunday    => 64,
        _                   => 0,
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static MenuDto ToDto(Menu m) => new(
        m.Id, m.Name, m.IsActive, m.SortOrder,
        m.Translations.Select(t => new MenuTranslationDto(t.Language.ToString(), t.Name)),
        m.ScheduleRules.Select(ToRuleDto),
        m.MenuCategories.Select(mc => mc.CategoryId));

    private static ScheduleRuleDto ToRuleDto(MenuScheduleRule r) => new(
        r.Id,
        r.RuleType.ToString(),
        r.TimeStart?.ToString("HH:mm"),
        r.TimeEnd?.ToString("HH:mm"),
        r.DaysOfWeek,
        r.DateStart?.ToString("yyyy-MM-dd"),
        r.DateEnd?.ToString("yyyy-MM-dd"));

    private static object Snapshot(Menu m) => new { m.Name, m.IsActive, m.SortOrder };
}

