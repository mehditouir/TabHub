using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TabHub.API.Domain.Entities;
using TabHub.API.Domain.Enums;

namespace TabHub.API.Infrastructure.Persistence;

public partial class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    // ── Public schema ────────────────────────────────────────────────────────
    public DbSet<Tenant>        Tenants        => Set<Tenant>();
    public DbSet<Manager>       Managers       => Set<Manager>();
    public DbSet<ManagerTenant> ManagerTenants => Set<ManagerTenant>();
    public DbSet<RefreshToken>  RefreshTokens  => Set<RefreshToken>();

    // ── Tenant schema (routed via search_path) ───────────────────────────────
    public DbSet<Config>               Configs              => Set<Config>();
    public DbSet<Space>                Spaces               => Set<Space>();
    public DbSet<SpaceTranslation>     SpaceTranslations    => Set<SpaceTranslation>();
    public DbSet<RestaurantTable>      Tables               => Set<RestaurantTable>();
    public DbSet<Staff>                Staff                => Set<Staff>();
    public DbSet<WaiterZone>           WaiterZones          => Set<WaiterZone>();
    public DbSet<Category>             Categories           => Set<Category>();
    public DbSet<CategoryTranslation>  CategoryTranslations => Set<CategoryTranslation>();
    public DbSet<MenuItem>             MenuItems            => Set<MenuItem>();
    public DbSet<MenuItemTranslation>  MenuItemTranslations => Set<MenuItemTranslation>();
    public DbSet<Ingredient>                Ingredients              => Set<Ingredient>();
    public DbSet<IngredientTranslation>     IngredientTranslations   => Set<IngredientTranslation>();
    public DbSet<MenuItemIngredient>        MenuItemIngredients      => Set<MenuItemIngredient>();
    public DbSet<Menu>                      Menus                    => Set<Menu>();
    public DbSet<MenuTranslation>           MenuTranslations         => Set<MenuTranslation>();
    public DbSet<MenuScheduleRule>          MenuScheduleRules        => Set<MenuScheduleRule>();
    public DbSet<MenuCategory>              MenuCategories           => Set<MenuCategory>();
    public DbSet<ModifierGroup>             ModifierGroups           => Set<ModifierGroup>();
    public DbSet<ModifierGroupTranslation>  ModifierGroupTranslations => Set<ModifierGroupTranslation>();
    public DbSet<ModifierOption>            ModifierOptions          => Set<ModifierOption>();
    public DbSet<ModifierOptionTranslation> ModifierOptionTranslations => Set<ModifierOptionTranslation>();
    public DbSet<AuditLog>                  AuditLogs                => Set<AuditLog>();
    public DbSet<Notification>              Notifications            => Set<Notification>();
    public DbSet<TableSession>              TableSessions            => Set<TableSession>();
    public DbSet<Order>                     Orders                   => Set<Order>();
    public DbSet<OrderItem>                 OrderItems               => Set<OrderItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ── Public schema entities ───────────────────────────────────────────

        modelBuilder.Entity<Tenant>(e =>
        {
            e.ToTable("tenants", "public");
            e.HasKey(t => t.Id);
            e.Property(t => t.Slug).HasMaxLength(63).IsRequired();
            e.Property(t => t.SchemaName).HasMaxLength(63).IsRequired();
            e.Property(t => t.Name).HasMaxLength(255).IsRequired();
            e.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
            e.Ignore(t => t.IsActive); // computed property, no DB column
            e.HasIndex(t => t.Slug).IsUnique();
        });

        modelBuilder.Entity<Manager>(e =>
        {
            e.ToTable("managers", "public");
            e.HasKey(m => m.Id);
            e.Property(m => m.Email).HasMaxLength(320).IsRequired();
            e.Property(m => m.PasswordHash).HasMaxLength(500).IsRequired();
            e.Property(m => m.DisplayName).HasMaxLength(255).IsRequired();
            e.HasIndex(m => m.Email).IsUnique();
        });

        modelBuilder.Entity<ManagerTenant>(e =>
        {
            e.ToTable("manager_tenants", "public");
            e.HasKey(mt => new { mt.ManagerId, mt.TenantId });
            e.Property(mt => mt.Role).HasConversion<string>().HasMaxLength(20);
            e.HasOne(mt => mt.Manager).WithMany(m => m.ManagerTenants).HasForeignKey(mt => mt.ManagerId);
            e.HasOne(mt => mt.Tenant).WithMany(t => t.ManagerTenants).HasForeignKey(mt => mt.TenantId);
        });

        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.ToTable("refresh_tokens", "public");
            e.HasKey(r => r.Id);
            e.Property(r => r.TokenHash).HasMaxLength(64).IsRequired();
            e.HasIndex(r => r.TokenHash).IsUnique();
            e.HasOne(r => r.Manager).WithMany(m => m.RefreshTokens).HasForeignKey(r => r.ManagerId);
        });

        // ── Tenant schema entities (no schema prefix — uses search_path) ─────

        modelBuilder.Entity<Config>(e =>
        {
            e.ToTable("configs");
            e.HasKey(c => c.Key);
            e.Property(c => c.Key).HasMaxLength(100);
        });

        modelBuilder.Entity<Space>(e =>
        {
            e.ToTable("spaces");
            e.HasKey(s => s.Id);
            e.HasQueryFilter(s => s.DeletedAt == null);
        });

        modelBuilder.Entity<SpaceTranslation>(e =>
        {
            e.ToTable("space_translations");
            e.HasKey(t => new { t.SpaceId, t.Language });
            e.Property(t => t.Language).HasConversion<string>().HasMaxLength(2);
            e.HasOne(t => t.Space).WithMany(s => s.Translations).HasForeignKey(t => t.SpaceId);
        });

        modelBuilder.Entity<RestaurantTable>(e =>
        {
            e.ToTable("tables");
            e.HasKey(t => t.Id);
            e.Property(t => t.Number).HasMaxLength(20);
            e.HasIndex(t => t.QrToken).IsUnique();
            e.HasQueryFilter(t => t.DeletedAt == null);
            e.HasOne(t => t.Space).WithMany(s => s.Tables).HasForeignKey(t => t.SpaceId);
        });

        modelBuilder.Entity<Staff>(e =>
        {
            e.ToTable("staff");
            e.HasKey(s => s.Id);
            e.Property(s => s.Role).HasConversion<string>().HasMaxLength(20);
            e.HasQueryFilter(s => s.DeletedAt == null);
        });

        modelBuilder.Entity<WaiterZone>(e =>
        {
            e.ToTable("waiter_zones");
            e.HasKey(w => w.Id);
            e.HasOne(w => w.Staff).WithMany(s => s.WaiterZones).HasForeignKey(w => w.StaffId);
            e.HasOne(w => w.Space).WithMany(s => s.WaiterZones).HasForeignKey(w => w.SpaceId);
        });

        modelBuilder.Entity<Category>(e =>
        {
            e.ToTable("categories");
            e.HasKey(c => c.Id);
            e.HasQueryFilter(c => c.DeletedAt == null);
        });

        modelBuilder.Entity<CategoryTranslation>(e =>
        {
            e.ToTable("category_translations");
            e.HasKey(t => new { t.CategoryId, t.Language });
            e.Property(t => t.Language).HasConversion<string>().HasMaxLength(2);
            e.HasOne(t => t.Category).WithMany(c => c.Translations).HasForeignKey(t => t.CategoryId);
        });

        modelBuilder.Entity<MenuItem>(e =>
        {
            e.ToTable("menu_items");
            e.HasKey(i => i.Id);
            e.Property(i => i.Price).HasColumnType("numeric(10,3)");
            e.HasQueryFilter(i => i.DeletedAt == null);
            e.HasOne(i => i.Category).WithMany(c => c.Items).HasForeignKey(i => i.CategoryId);
        });

        modelBuilder.Entity<MenuItemTranslation>(e =>
        {
            e.ToTable("menu_item_translations");
            e.HasKey(t => new { t.ItemId, t.Language });
            e.Property(t => t.Language).HasConversion<string>().HasMaxLength(2);
            e.HasOne(t => t.Item).WithMany(i => i.Translations).HasForeignKey(t => t.ItemId);
        });

        modelBuilder.Entity<Ingredient>(e =>
        {
            e.ToTable("ingredients");
            e.HasKey(i => i.Id);
            e.HasQueryFilter(i => i.DeletedAt == null);
        });

        modelBuilder.Entity<IngredientTranslation>(e =>
        {
            e.ToTable("ingredient_translations");
            e.HasKey(t => new { t.IngredientId, t.Language });
            e.Property(t => t.Language).HasConversion<string>().HasMaxLength(2);
            e.HasOne(t => t.Ingredient).WithMany(i => i.Translations).HasForeignKey(t => t.IngredientId);
        });

        modelBuilder.Entity<MenuItemIngredient>(e =>
        {
            e.ToTable("menu_item_ingredients");
            e.HasKey(j => new { j.MenuItemId, j.IngredientId });
            e.HasOne(j => j.MenuItem).WithMany(i => i.Ingredients).HasForeignKey(j => j.MenuItemId);
            e.HasOne(j => j.Ingredient).WithMany(i => i.MenuItems).HasForeignKey(j => j.IngredientId);
        });

        modelBuilder.Entity<Menu>(e =>
        {
            e.ToTable("menus");
            e.HasKey(m => m.Id);
            e.HasQueryFilter(m => m.DeletedAt == null);
        });

        modelBuilder.Entity<MenuTranslation>(e =>
        {
            e.ToTable("menu_translations");
            e.HasKey(t => new { t.MenuId, t.Language });
            e.Property(t => t.Language).HasConversion<string>().HasMaxLength(2);
            e.HasOne(t => t.Menu).WithMany(m => m.Translations).HasForeignKey(t => t.MenuId);
        });

        modelBuilder.Entity<MenuScheduleRule>(e =>
        {
            e.ToTable("menu_schedule_rules");
            e.HasKey(r => r.Id);
            e.Property(r => r.RuleType).HasConversion<string>().HasMaxLength(20);
            e.HasOne(r => r.Menu).WithMany(m => m.ScheduleRules).HasForeignKey(r => r.MenuId);
        });

        modelBuilder.Entity<MenuCategory>(e =>
        {
            e.ToTable("menu_categories");
            e.HasKey(j => new { j.MenuId, j.CategoryId });
            e.HasOne(j => j.Menu).WithMany(m => m.MenuCategories).HasForeignKey(j => j.MenuId);
            e.HasOne(j => j.Category).WithMany().HasForeignKey(j => j.CategoryId);
        });

        modelBuilder.Entity<ModifierGroup>(e =>
        {
            e.ToTable("modifier_groups");
            e.HasKey(g => g.Id);
            e.HasOne(g => g.MenuItem).WithMany(i => i.ModifierGroups).HasForeignKey(g => g.MenuItemId);
        });

        modelBuilder.Entity<ModifierGroupTranslation>(e =>
        {
            e.ToTable("modifier_group_translations");
            e.HasKey(t => new { t.ModifierGroupId, t.Language });
            e.Property(t => t.Language).HasConversion<string>().HasMaxLength(2);
            e.HasOne(t => t.ModifierGroup).WithMany(g => g.Translations).HasForeignKey(t => t.ModifierGroupId);
        });

        modelBuilder.Entity<ModifierOption>(e =>
        {
            e.ToTable("modifier_options");
            e.HasKey(o => o.Id);
            e.Property(o => o.PriceDelta).HasColumnType("numeric(10,3)");
            e.HasOne(o => o.ModifierGroup).WithMany(g => g.Options).HasForeignKey(o => o.ModifierGroupId);
        });

        modelBuilder.Entity<ModifierOptionTranslation>(e =>
        {
            e.ToTable("modifier_option_translations");
            e.HasKey(t => new { t.ModifierOptionId, t.Language });
            e.Property(t => t.Language).HasConversion<string>().HasMaxLength(2);
            e.HasOne(t => t.ModifierOption).WithMany(o => o.Translations).HasForeignKey(t => t.ModifierOptionId);
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.ToTable("audit_logs");
            e.HasKey(a => a.Id);
            e.Property(a => a.EntityType).HasMaxLength(100);
            e.Property(a => a.Action).HasMaxLength(50);
            e.Property(a => a.ActorType).HasConversion<string>().HasMaxLength(20);
            e.Property(a => a.BeforeState).HasColumnType("jsonb");
            e.Property(a => a.AfterState).HasColumnType("jsonb");
        });

        modelBuilder.Entity<Notification>(e =>
        {
            e.ToTable("notifications");
            e.HasKey(n => n.Id);
            e.Property(n => n.EventType).HasMaxLength(50);
            e.HasOne(n => n.Order).WithMany().HasForeignKey(n => n.OrderId);
            e.HasOne(n => n.AcknowledgedByStaff).WithMany().HasForeignKey(n => n.AcknowledgedByStaffId);
        });

        modelBuilder.Entity<TableSession>(e =>
        {
            e.ToTable("table_sessions");
            e.HasKey(s => s.Id);
            e.HasOne(s => s.Table).WithMany().HasForeignKey(s => s.TableId);
            e.HasOne(s => s.Staff).WithMany().HasForeignKey(s => s.StaffId);
        });

        modelBuilder.Entity<Order>(e =>
        {
            e.ToTable("orders");
            e.HasKey(o => o.Id);
            e.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(o => o.OrderType).HasConversion<string>().HasMaxLength(20);
            e.Ignore(o => o.Total); // computed from Items, not a DB column
            e.HasOne(o => o.Table).WithMany().HasForeignKey(o => o.TableId);
            e.HasOne(o => o.Session).WithMany(s => s.Orders).HasForeignKey(o => o.SessionId);
        });

        modelBuilder.Entity<OrderItem>(e =>
        {
            e.ToTable("order_items");
            e.HasKey(i => i.Id);
            e.Property(i => i.UnitPrice).HasColumnType("numeric(10,3)");
            e.Property(i => i.MenuItemName).HasMaxLength(255);
            e.HasOne(i => i.Order).WithMany(o => o.Items).HasForeignKey(i => i.OrderId);
            e.HasOne(i => i.MenuItem).WithMany().HasForeignKey(i => i.MenuItemId);
        });

        // Apply snake_case to all table and column names (PostgreSQL convention)
        ApplySnakeCaseConventions(modelBuilder);
    }

    /// <summary>
    /// Converts all EF Core PascalCase identifiers to PostgreSQL snake_case.
    /// Applied globally so every entity added in future sprints gets correct naming automatically.
    /// </summary>
    private static void ApplySnakeCaseConventions(ModelBuilder modelBuilder)
    {
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            var tableName = entity.GetTableName();
            if (tableName is not null)
                entity.SetTableName(ToSnakeCase(tableName));

            foreach (var property in entity.GetProperties())
                property.SetColumnName(ToSnakeCase(property.Name));

            foreach (var key in entity.GetKeys())
                if (key.GetName() is { } kn)
                    key.SetName(ToSnakeCase(kn));

            foreach (var fk in entity.GetForeignKeys())
                if (fk.GetConstraintName() is { } fn)
                    fk.SetConstraintName(ToSnakeCase(fn));

            foreach (var index in entity.GetIndexes())
                if (index.GetDatabaseName() is { } idn)
                    index.SetDatabaseName(ToSnakeCase(idn));
        }
    }

    /// <summary>
    /// Switches the PostgreSQL search_path for this connection to the given tenant schema.
    /// Schema name is validated against a strict allowlist pattern before use.
    /// </summary>
    public async Task SetSearchPathAsync(string schemaName)
    {
        AssertSafeIdentifier(schemaName);
#pragma warning disable EF1002 // Schema name is validated above — only a-z, 0-9, _ allowed
        await Database.ExecuteSqlRawAsync($"SET search_path TO \"{schemaName}\", public");
#pragma warning restore EF1002
    }

    /// <summary>
    /// Ensures a PostgreSQL identifier contains only safe characters (a-z, 0-9, underscore).
    /// </summary>
    public static void AssertSafeIdentifier(string name)
    {
        if (!SafeIdentifier().IsMatch(name))
            throw new ArgumentException($"Unsafe PostgreSQL identifier: '{name}'");
    }

    private static string ToSnakeCase(string name) =>
        PascalCasePattern().Replace(name, m =>
            (m.Index == 0 ? "" : "_") + m.Value.ToLowerInvariant());

    [GeneratedRegex(@"[A-Z][a-z0-9]*")]
    private static partial Regex PascalCasePattern();

    [GeneratedRegex(@"^[a-z0-9_]{1,63}$")]
    private static partial Regex SafeIdentifier();
}
