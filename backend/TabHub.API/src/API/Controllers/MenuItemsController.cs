using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TabHub.API.API.Dtos;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Services;

namespace TabHub.API.API.Controllers;


[Route("menu-items")]
public class MenuItemsController(AppDbContext db, AuditService audit, ICurrentActor actor)
    : TenantControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.MenuItems
            .Include(i => i.Translations)
            .Select(i => ToDto(i))
            .ToListAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var item = await db.MenuItems.Include(i => i.Translations).FirstOrDefaultAsync(i => i.Id == id);
        return item is null ? NotFound() : Ok(ToDto(item));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMenuItemRequest req)
    {
        var item = new MenuItem
        {
            CategoryId  = req.CategoryId,
            Name        = req.Name,
            Price       = req.Price,
            Description = req.Description,
            ImageUrl    = req.ImageUrl,
            SortOrder   = req.SortOrder,
        };

        db.MenuItems.Add(item);
        await db.SaveChangesAsync();
        await audit.LogAsync("create", nameof(MenuItem), item.Id.ToString(), actor, after: Snapshot(item));

        return Created($"/menu-items/{item.Id}", ToDto(item));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateMenuItemRequest req)
    {
        var item = await db.MenuItems.FindAsync(id);
        if (item is null) return NotFound();

        var before = Snapshot(item);
        item.CategoryId   = req.CategoryId;
        item.Name         = req.Name;
        item.Price        = req.Price;
        item.IsAvailable  = req.IsAvailable;
        item.Description  = req.Description;
        item.ImageUrl     = req.ImageUrl;
        item.SortOrder    = req.SortOrder;
        item.UpdatedAt    = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("update", nameof(MenuItem), item.Id.ToString(), actor, before, after: Snapshot(item));

        return Ok(ToDto(item));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var item = await db.MenuItems.FindAsync(id);
        if (item is null) return NotFound();

        item.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await audit.LogAsync("delete", nameof(MenuItem), item.Id.ToString(), actor, before: Snapshot(item));

        return NoContent();
    }

    [HttpPut("{id:guid}/translations/{language}")]
    public async Task<IActionResult> SetTranslation(Guid id, string language, [FromBody] SetMenuItemTranslationRequest req)
    {
        if (!Enum.TryParse<Language>(language.ToUpper(), out var lang))
            return BadRequest(new { error = "Invalid language. Use FR, AR or EN." });

        var item = await db.MenuItems.FindAsync(id);
        if (item is null) return NotFound();

        var translation = await db.MenuItemTranslations.FindAsync(id, lang);
        if (translation is null)
        {
            db.MenuItemTranslations.Add(new MenuItemTranslation
            {
                ItemId      = id,
                Language    = lang,
                Name        = req.Name,
                Description = req.Description,
            });
        }
        else
        {
            translation.Name        = req.Name;
            translation.Description = req.Description;
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/image")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file, [FromServices] IImageStorageService imageStorage)
    {
        var item = await db.MenuItems.FindAsync(id);
        if (item is null) return NotFound();

        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });

        var url = await imageStorage.StoreAsync(file, "menu-items");
        if (url is null)
            return StatusCode(503, new { error = "Image storage is not configured." });

        item.ImageUrl  = url;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { imageUrl = url });
    }

    private static MenuItemDto ToDto(MenuItem i) => new(
        i.Id, i.CategoryId, i.Name, i.Price, i.IsAvailable, i.SortOrder,
        i.Description, i.ImageUrl,
        i.Translations.Select(t => new MenuItemTranslationDto(t.Language.ToString(), t.Name, t.Description)));

    private static object Snapshot(MenuItem i) =>
        new { i.CategoryId, i.Name, i.Price, i.IsAvailable, i.SortOrder, i.Description, i.ImageUrl };
}
