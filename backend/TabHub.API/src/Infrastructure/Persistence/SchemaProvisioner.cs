using Microsoft.EntityFrameworkCore;

namespace TabHub.API.Infrastructure.Persistence;

/// <summary>
/// Creates a new PostgreSQL schema for a tenant and provisions all tenant-scoped tables.
/// Called once when a new tenant is registered.
/// </summary>
public class SchemaProvisioner(AppDbContext db, ILogger<SchemaProvisioner> logger)
{
    public async Task ProvisionAsync(string schemaName)
    {
        AppDbContext.AssertSafeIdentifier(schemaName);

        logger.LogInformation("Provisioning schema '{Schema}'", schemaName);

#pragma warning disable EF1002 // Schema name validated by AssertSafeIdentifier above
        await db.Database.ExecuteSqlRawAsync($"CREATE SCHEMA IF NOT EXISTS \"{schemaName}\"");
        await db.SetSearchPathAsync(schemaName);
        await db.Database.ExecuteSqlRawAsync(TenantSchemaDdl);
#pragma warning restore EF1002

        logger.LogInformation("Schema '{Schema}' provisioned successfully", schemaName);
    }

    /// <summary>
    /// DDL for all tenant-scoped tables. All statements use IF NOT EXISTS — safe to run multiple times.
    /// Updated each sprint as new entities are introduced.
    /// </summary>
    public const string TenantSchemaDdl = """
        CREATE TABLE IF NOT EXISTS configs (
            key        VARCHAR(100) PRIMARY KEY,
            value      TEXT         NOT NULL,
            updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS spaces (
            id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            name       VARCHAR(255) NOT NULL,
            cols       SMALLINT     NOT NULL,
            rows       SMALLINT     NOT NULL,
            sort_order SMALLINT     NOT NULL DEFAULT 0,
            is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS space_translations (
            space_id   UUID        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
            language   VARCHAR(2)  NOT NULL,
            name       VARCHAR(255) NOT NULL,
            PRIMARY KEY (space_id, language)
        );

        CREATE TABLE IF NOT EXISTS tables (
            id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            space_id   UUID        NOT NULL REFERENCES spaces(id),
            number     VARCHAR(20)  NOT NULL,
            col        SMALLINT     NOT NULL,
            row        SMALLINT     NOT NULL,
            qr_token   UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS staff (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            display_name VARCHAR(255) NOT NULL,
            role         VARCHAR(20)  NOT NULL,
            pin_hash     TEXT         NOT NULL,
            is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            deleted_at   TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS waiter_zones (
            id        UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_id  UUID     NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
            space_id  UUID     NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
            col_start SMALLINT NOT NULL,
            col_end   SMALLINT NOT NULL,
            row_start SMALLINT NOT NULL,
            row_end   SMALLINT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS categories (
            id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            name       VARCHAR(255) NOT NULL,
            sort_order SMALLINT     NOT NULL DEFAULT 0,
            is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS category_translations (
            category_id UUID        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            language    VARCHAR(2)  NOT NULL,
            name        VARCHAR(255) NOT NULL,
            PRIMARY KEY (category_id, language)
        );

        CREATE TABLE IF NOT EXISTS menu_items (
            id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
            category_id UUID          NOT NULL REFERENCES categories(id),
            name        VARCHAR(255)  NOT NULL,
            description TEXT,
            price       NUMERIC(10,3) NOT NULL,
            image_url   TEXT,
            is_available BOOLEAN      NOT NULL DEFAULT TRUE,
            sort_order  SMALLINT      NOT NULL DEFAULT 0,
            created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            deleted_at  TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS menu_item_translations (
            item_id     UUID        NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
            language    VARCHAR(2)  NOT NULL,
            name        VARCHAR(255) NOT NULL,
            description TEXT,
            PRIMARY KEY (item_id, language)
        );

        CREATE TABLE IF NOT EXISTS table_sessions (
            id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            table_id   UUID        NOT NULL REFERENCES tables(id),
            staff_id   UUID        REFERENCES staff(id),
            notes      TEXT,
            opened_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            closed_at  TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS orders (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            table_id        UUID        REFERENCES tables(id),
            session_id      UUID        REFERENCES table_sessions(id),
            order_type      VARCHAR(20) NOT NULL DEFAULT 'DineIn',
            sequence_number VARCHAR(13),
            status          VARCHAR(20) NOT NULL DEFAULT 'Pending',
            notes           TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id       UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            menu_item_id   UUID          NOT NULL REFERENCES menu_items(id),
            menu_item_name VARCHAR(255)  NOT NULL,
            unit_price     NUMERIC(10,3) NOT NULL,
            quantity       INTEGER       NOT NULL,
            notes          TEXT
        );

        CREATE TABLE IF NOT EXISTS ingredients (
            id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            name       VARCHAR(255) NOT NULL,
            is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS ingredient_translations (
            ingredient_id UUID        NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
            language      VARCHAR(2)  NOT NULL,
            name          VARCHAR(255) NOT NULL,
            PRIMARY KEY (ingredient_id, language)
        );

        CREATE TABLE IF NOT EXISTS menu_item_ingredients (
            menu_item_id  UUID NOT NULL REFERENCES menu_items(id)  ON DELETE CASCADE,
            ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
            PRIMARY KEY (menu_item_id, ingredient_id)
        );

        CREATE TABLE IF NOT EXISTS menus (
            id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            name       VARCHAR(255) NOT NULL,
            is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
            sort_order SMALLINT     NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS menu_translations (
            menu_id  UUID        NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
            language VARCHAR(2)  NOT NULL,
            name     VARCHAR(255) NOT NULL,
            PRIMARY KEY (menu_id, language)
        );

        CREATE TABLE IF NOT EXISTS menu_schedule_rules (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            menu_id     UUID        NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
            rule_type   VARCHAR(20) NOT NULL,
            time_start  TIME,
            time_end    TIME,
            days_of_week INTEGER,
            date_start  DATE,
            date_end    DATE
        );

        CREATE TABLE IF NOT EXISTS menu_categories (
            menu_id     UUID NOT NULL REFERENCES menus(id)      ON DELETE CASCADE,
            category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            PRIMARY KEY (menu_id, category_id)
        );

        CREATE TABLE IF NOT EXISTS modifier_groups (
            id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            menu_item_id   UUID         NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
            name           VARCHAR(255) NOT NULL,
            is_required    BOOLEAN      NOT NULL DEFAULT FALSE,
            min_selections INTEGER      NOT NULL DEFAULT 0,
            max_selections INTEGER      NOT NULL DEFAULT 1,
            sort_order     SMALLINT     NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS modifier_group_translations (
            modifier_group_id UUID        NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
            language          VARCHAR(2)  NOT NULL,
            name              VARCHAR(255) NOT NULL,
            PRIMARY KEY (modifier_group_id, language)
        );

        CREATE TABLE IF NOT EXISTS modifier_options (
            id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
            modifier_group_id UUID          NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
            name              VARCHAR(255)  NOT NULL,
            price_delta       NUMERIC(10,3) NOT NULL DEFAULT 0,
            is_available      BOOLEAN       NOT NULL DEFAULT TRUE,
            sort_order        SMALLINT      NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS modifier_option_translations (
            modifier_option_id UUID        NOT NULL REFERENCES modifier_options(id) ON DELETE CASCADE,
            language           VARCHAR(2)  NOT NULL,
            name               VARCHAR(255) NOT NULL,
            PRIMARY KEY (modifier_option_id, language)
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type               VARCHAR(50) NOT NULL,
            order_id                 UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            table_id                 UUID        REFERENCES tables(id),
            is_acknowledged          BOOLEAN     NOT NULL DEFAULT FALSE,
            acknowledged_by_staff_id UUID        REFERENCES staff(id),
            acknowledged_at          TIMESTAMPTZ,
            created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_type  VARCHAR(100) NOT NULL,
            entity_id    VARCHAR(100),
            action       VARCHAR(50)  NOT NULL,
            actor_type   VARCHAR(20)  NOT NULL,
            actor_id     VARCHAR(100),
            actor_display VARCHAR(255),
            before_state JSONB,
            after_state  JSONB,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
        """;
}
