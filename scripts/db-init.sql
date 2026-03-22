-- Runs once on first Docker startup (docker-entrypoint-initdb.d)
-- Also run directly via NpgsqlCommand in Testcontainers for integration tests.
-- Uses only simple SQL (no PL/pgSQL functions) for cross-driver compatibility.

-- ── Public schema ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenants (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        VARCHAR(63) NOT NULL UNIQUE,
    schema_name VARCHAR(63) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Dev tenants ───────────────────────────────────────────────────────────────

INSERT INTO public.tenants (slug, schema_name, name)
VALUES ('cafetunisia', 'cafetunisia', 'Cafe Tunisia')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tenants (slug, schema_name, name)
VALUES ('restauranttunisia', 'restauranttunisia', 'Restaurant Tunisia')
ON CONFLICT (slug) DO NOTHING;

-- ── Dev manager account ───────────────────────────────────────────────────────
-- mehdi@cafetunisia.com / mehdi123  (Owner of cafetunisia tenant)

INSERT INTO public.managers (id, email, password_hash, display_name, is_super_admin, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'mehdi@cafetunisia.com',
    'v1:yBlvQEuHLrESSCiKbP1bug==:cTBvblA+3YxUuFTvD/40bsEPPmMc7PZ3RACPxYpstMs=',
    'Mehdi',
    false,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.manager_tenants (manager_id, tenant_id, role, created_at)
SELECT
    '00000000-0000-0000-0000-000000000001',
    t.id,
    'Owner',
    NOW()
FROM public.tenants t
WHERE t.slug = 'cafetunisia'
ON CONFLICT (manager_id, tenant_id) DO NOTHING;

-- ── cafetunisia schema ────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS cafetunisia;

CREATE TABLE IF NOT EXISTS cafetunisia.configs (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT         NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cafetunisia.spaces (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    cols       SMALLINT     NOT NULL,
    rows       SMALLINT     NOT NULL,
    sort_order SMALLINT     NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cafetunisia.space_translations (
    space_id   UUID        NOT NULL REFERENCES cafetunisia.spaces(id) ON DELETE CASCADE,
    language   VARCHAR(2)  NOT NULL,
    name       VARCHAR(255) NOT NULL,
    PRIMARY KEY (space_id, language)
);

CREATE TABLE IF NOT EXISTS cafetunisia.tables (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id   UUID        NOT NULL REFERENCES cafetunisia.spaces(id),
    number     VARCHAR(20)  NOT NULL,
    col        SMALLINT     NOT NULL,
    row        SMALLINT     NOT NULL,
    qr_token   UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cafetunisia.staff (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(255) NOT NULL,
    role         VARCHAR(20)  NOT NULL,
    pin_hash     TEXT         NOT NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cafetunisia.waiter_zones (
    id         UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id   UUID     NOT NULL REFERENCES cafetunisia.staff(id)  ON DELETE CASCADE,
    space_id   UUID     NOT NULL REFERENCES cafetunisia.spaces(id) ON DELETE CASCADE,
    col_start  SMALLINT NOT NULL,
    col_end    SMALLINT NOT NULL,
    row_start  SMALLINT NOT NULL,
    row_end    SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cafetunisia.categories (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    sort_order SMALLINT     NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cafetunisia.category_translations (
    category_id UUID        NOT NULL REFERENCES cafetunisia.categories(id) ON DELETE CASCADE,
    language    VARCHAR(2)  NOT NULL,
    name        VARCHAR(255) NOT NULL,
    PRIMARY KEY (category_id, language)
);

CREATE TABLE IF NOT EXISTS cafetunisia.menu_items (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id  UUID          NOT NULL REFERENCES cafetunisia.categories(id),
    name         VARCHAR(255)  NOT NULL,
    description  TEXT,
    price        NUMERIC(10,3) NOT NULL,
    image_url    TEXT,
    is_available BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order   SMALLINT      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cafetunisia.menu_item_translations (
    item_id     UUID        NOT NULL REFERENCES cafetunisia.menu_items(id) ON DELETE CASCADE,
    language    VARCHAR(2)  NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    PRIMARY KEY (item_id, language)
);

CREATE TABLE IF NOT EXISTS cafetunisia.ingredients (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cafetunisia.ingredient_translations (
    ingredient_id UUID        NOT NULL REFERENCES cafetunisia.ingredients(id) ON DELETE CASCADE,
    language      VARCHAR(2)  NOT NULL,
    name          VARCHAR(255) NOT NULL,
    PRIMARY KEY (ingredient_id, language)
);

CREATE TABLE IF NOT EXISTS cafetunisia.menu_item_ingredients (
    menu_item_id  UUID NOT NULL REFERENCES cafetunisia.menu_items(id)  ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES cafetunisia.ingredients(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_item_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS cafetunisia.menus (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order SMALLINT     NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cafetunisia.menu_translations (
    menu_id  UUID        NOT NULL REFERENCES cafetunisia.menus(id) ON DELETE CASCADE,
    language VARCHAR(2)  NOT NULL,
    name     VARCHAR(255) NOT NULL,
    PRIMARY KEY (menu_id, language)
);

CREATE TABLE IF NOT EXISTS cafetunisia.menu_schedule_rules (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id      UUID        NOT NULL REFERENCES cafetunisia.menus(id) ON DELETE CASCADE,
    rule_type    VARCHAR(20) NOT NULL,
    time_start   TIME,
    time_end     TIME,
    days_of_week INTEGER,
    date_start   DATE,
    date_end     DATE
);

CREATE TABLE IF NOT EXISTS cafetunisia.menu_categories (
    menu_id     UUID NOT NULL REFERENCES cafetunisia.menus(id)       ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES cafetunisia.categories(id)  ON DELETE CASCADE,
    PRIMARY KEY (menu_id, category_id)
);

CREATE TABLE IF NOT EXISTS cafetunisia.modifier_groups (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id   UUID         NOT NULL REFERENCES cafetunisia.menu_items(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    is_required    BOOLEAN      NOT NULL DEFAULT FALSE,
    min_selections INTEGER      NOT NULL DEFAULT 0,
    max_selections INTEGER      NOT NULL DEFAULT 1,
    sort_order     SMALLINT     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cafetunisia.modifier_group_translations (
    modifier_group_id UUID        NOT NULL REFERENCES cafetunisia.modifier_groups(id) ON DELETE CASCADE,
    language          VARCHAR(2)  NOT NULL,
    name              VARCHAR(255) NOT NULL,
    PRIMARY KEY (modifier_group_id, language)
);

CREATE TABLE IF NOT EXISTS cafetunisia.modifier_options (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_group_id UUID          NOT NULL REFERENCES cafetunisia.modifier_groups(id) ON DELETE CASCADE,
    name              VARCHAR(255)  NOT NULL,
    price_delta       NUMERIC(10,3) NOT NULL DEFAULT 0,
    is_available      BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order        SMALLINT      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cafetunisia.modifier_option_translations (
    modifier_option_id UUID        NOT NULL REFERENCES cafetunisia.modifier_options(id) ON DELETE CASCADE,
    language           VARCHAR(2)  NOT NULL,
    name               VARCHAR(255) NOT NULL,
    PRIMARY KEY (modifier_option_id, language)
);

CREATE TABLE IF NOT EXISTS cafetunisia.table_sessions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id   UUID        NOT NULL REFERENCES cafetunisia.tables(id),
    staff_id   UUID        REFERENCES cafetunisia.staff(id),
    notes      TEXT,
    opened_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cafetunisia.orders (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id        UUID        REFERENCES cafetunisia.tables(id),
    session_id      UUID        REFERENCES cafetunisia.table_sessions(id),
    order_type      VARCHAR(20) NOT NULL DEFAULT 'DineIn',
    sequence_number VARCHAR(13),
    status          VARCHAR(20) NOT NULL DEFAULT 'Pending',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: add new columns to existing orders table (safe to run multiple times)
ALTER TABLE cafetunisia.orders ADD COLUMN IF NOT EXISTS session_id      UUID        REFERENCES cafetunisia.table_sessions(id);
ALTER TABLE cafetunisia.orders ADD COLUMN IF NOT EXISTS order_type      VARCHAR(20) NOT NULL DEFAULT 'DineIn';
ALTER TABLE cafetunisia.orders ADD COLUMN IF NOT EXISTS sequence_number VARCHAR(13);
ALTER TABLE cafetunisia.orders ALTER COLUMN table_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS cafetunisia.order_items (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID          NOT NULL REFERENCES cafetunisia.orders(id) ON DELETE CASCADE,
    menu_item_id   UUID          NOT NULL REFERENCES cafetunisia.menu_items(id),
    menu_item_name VARCHAR(255)  NOT NULL,
    unit_price     NUMERIC(10,3) NOT NULL,
    quantity       INTEGER       NOT NULL,
    notes          TEXT
);

CREATE TABLE IF NOT EXISTS cafetunisia.notifications (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type               VARCHAR(50) NOT NULL,
    order_id                 UUID        NOT NULL REFERENCES cafetunisia.orders(id) ON DELETE CASCADE,
    table_id                 UUID        REFERENCES cafetunisia.tables(id),
    is_acknowledged          BOOLEAN     NOT NULL DEFAULT FALSE,
    acknowledged_by_staff_id UUID        REFERENCES cafetunisia.staff(id),
    acknowledged_at          TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cafetunisia.audit_logs (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(100) NOT NULL,
    entity_id     VARCHAR(100),
    action        VARCHAR(50)  NOT NULL,
    actor_type    VARCHAR(20)  NOT NULL,
    actor_id      VARCHAR(100),
    actor_display VARCHAR(255),
    before_state  JSONB,
    after_state   JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── restauranttunisia schema ──────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS restauranttunisia;

CREATE TABLE IF NOT EXISTS restauranttunisia.configs (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT         NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restauranttunisia.spaces (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    cols       SMALLINT     NOT NULL,
    rows       SMALLINT     NOT NULL,
    sort_order SMALLINT     NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS restauranttunisia.space_translations (
    space_id   UUID        NOT NULL REFERENCES restauranttunisia.spaces(id) ON DELETE CASCADE,
    language   VARCHAR(2)  NOT NULL,
    name       VARCHAR(255) NOT NULL,
    PRIMARY KEY (space_id, language)
);

CREATE TABLE IF NOT EXISTS restauranttunisia.tables (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id   UUID        NOT NULL REFERENCES restauranttunisia.spaces(id),
    number     VARCHAR(20)  NOT NULL,
    col        SMALLINT     NOT NULL,
    row        SMALLINT     NOT NULL,
    qr_token   UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS restauranttunisia.staff (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(255) NOT NULL,
    role         VARCHAR(20)  NOT NULL,
    pin_hash     TEXT         NOT NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS restauranttunisia.waiter_zones (
    id         UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id   UUID     NOT NULL REFERENCES restauranttunisia.staff(id)  ON DELETE CASCADE,
    space_id   UUID     NOT NULL REFERENCES restauranttunisia.spaces(id) ON DELETE CASCADE,
    col_start  SMALLINT NOT NULL,
    col_end    SMALLINT NOT NULL,
    row_start  SMALLINT NOT NULL,
    row_end    SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restauranttunisia.categories (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    sort_order SMALLINT     NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS restauranttunisia.category_translations (
    category_id UUID        NOT NULL REFERENCES restauranttunisia.categories(id) ON DELETE CASCADE,
    language    VARCHAR(2)  NOT NULL,
    name        VARCHAR(255) NOT NULL,
    PRIMARY KEY (category_id, language)
);

CREATE TABLE IF NOT EXISTS restauranttunisia.menu_items (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id  UUID          NOT NULL REFERENCES restauranttunisia.categories(id),
    name         VARCHAR(255)  NOT NULL,
    description  TEXT,
    price        NUMERIC(10,3) NOT NULL,
    image_url    TEXT,
    is_available BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order   SMALLINT      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS restauranttunisia.menu_item_translations (
    item_id     UUID        NOT NULL REFERENCES restauranttunisia.menu_items(id) ON DELETE CASCADE,
    language    VARCHAR(2)  NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    PRIMARY KEY (item_id, language)
);

CREATE TABLE IF NOT EXISTS restauranttunisia.ingredients (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS restauranttunisia.ingredient_translations (
    ingredient_id UUID        NOT NULL REFERENCES restauranttunisia.ingredients(id) ON DELETE CASCADE,
    language      VARCHAR(2)  NOT NULL,
    name          VARCHAR(255) NOT NULL,
    PRIMARY KEY (ingredient_id, language)
);

CREATE TABLE IF NOT EXISTS restauranttunisia.menu_item_ingredients (
    menu_item_id  UUID NOT NULL REFERENCES restauranttunisia.menu_items(id)  ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES restauranttunisia.ingredients(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_item_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS restauranttunisia.menus (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order SMALLINT     NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS restauranttunisia.menu_translations (
    menu_id  UUID        NOT NULL REFERENCES restauranttunisia.menus(id) ON DELETE CASCADE,
    language VARCHAR(2)  NOT NULL,
    name     VARCHAR(255) NOT NULL,
    PRIMARY KEY (menu_id, language)
);

CREATE TABLE IF NOT EXISTS restauranttunisia.menu_schedule_rules (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id      UUID        NOT NULL REFERENCES restauranttunisia.menus(id) ON DELETE CASCADE,
    rule_type    VARCHAR(20) NOT NULL,
    time_start   TIME,
    time_end     TIME,
    days_of_week INTEGER,
    date_start   DATE,
    date_end     DATE
);

CREATE TABLE IF NOT EXISTS restauranttunisia.menu_categories (
    menu_id     UUID NOT NULL REFERENCES restauranttunisia.menus(id)       ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES restauranttunisia.categories(id)  ON DELETE CASCADE,
    PRIMARY KEY (menu_id, category_id)
);

CREATE TABLE IF NOT EXISTS restauranttunisia.modifier_groups (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id   UUID         NOT NULL REFERENCES restauranttunisia.menu_items(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    is_required    BOOLEAN      NOT NULL DEFAULT FALSE,
    min_selections INTEGER      NOT NULL DEFAULT 0,
    max_selections INTEGER      NOT NULL DEFAULT 1,
    sort_order     SMALLINT     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS restauranttunisia.modifier_group_translations (
    modifier_group_id UUID        NOT NULL REFERENCES restauranttunisia.modifier_groups(id) ON DELETE CASCADE,
    language          VARCHAR(2)  NOT NULL,
    name              VARCHAR(255) NOT NULL,
    PRIMARY KEY (modifier_group_id, language)
);

CREATE TABLE IF NOT EXISTS restauranttunisia.modifier_options (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_group_id UUID          NOT NULL REFERENCES restauranttunisia.modifier_groups(id) ON DELETE CASCADE,
    name              VARCHAR(255)  NOT NULL,
    price_delta       NUMERIC(10,3) NOT NULL DEFAULT 0,
    is_available      BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order        SMALLINT      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS restauranttunisia.modifier_option_translations (
    modifier_option_id UUID        NOT NULL REFERENCES restauranttunisia.modifier_options(id) ON DELETE CASCADE,
    language           VARCHAR(2)  NOT NULL,
    name               VARCHAR(255) NOT NULL,
    PRIMARY KEY (modifier_option_id, language)
);

CREATE TABLE IF NOT EXISTS restauranttunisia.table_sessions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id   UUID        NOT NULL REFERENCES restauranttunisia.tables(id),
    staff_id   UUID        REFERENCES restauranttunisia.staff(id),
    notes      TEXT,
    opened_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS restauranttunisia.orders (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id        UUID        REFERENCES restauranttunisia.tables(id),
    session_id      UUID        REFERENCES restauranttunisia.table_sessions(id),
    order_type      VARCHAR(20) NOT NULL DEFAULT 'DineIn',
    sequence_number VARCHAR(13),
    status          VARCHAR(20) NOT NULL DEFAULT 'Pending',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: add new columns to existing orders table (safe to run multiple times)
ALTER TABLE restauranttunisia.orders ADD COLUMN IF NOT EXISTS session_id      UUID        REFERENCES restauranttunisia.table_sessions(id);
ALTER TABLE restauranttunisia.orders ADD COLUMN IF NOT EXISTS order_type      VARCHAR(20) NOT NULL DEFAULT 'DineIn';
ALTER TABLE restauranttunisia.orders ADD COLUMN IF NOT EXISTS sequence_number VARCHAR(13);
ALTER TABLE restauranttunisia.orders ALTER COLUMN table_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS restauranttunisia.order_items (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID          NOT NULL REFERENCES restauranttunisia.orders(id) ON DELETE CASCADE,
    menu_item_id   UUID          NOT NULL REFERENCES restauranttunisia.menu_items(id),
    menu_item_name VARCHAR(255)  NOT NULL,
    unit_price     NUMERIC(10,3) NOT NULL,
    quantity       INTEGER       NOT NULL,
    notes          TEXT
);

CREATE TABLE IF NOT EXISTS restauranttunisia.notifications (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type               VARCHAR(50) NOT NULL,
    order_id                 UUID        NOT NULL REFERENCES restauranttunisia.orders(id) ON DELETE CASCADE,
    table_id                 UUID        REFERENCES restauranttunisia.tables(id),
    is_acknowledged          BOOLEAN     NOT NULL DEFAULT FALSE,
    acknowledged_by_staff_id UUID        REFERENCES restauranttunisia.staff(id),
    acknowledged_at          TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restauranttunisia.audit_logs (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(100) NOT NULL,
    entity_id     VARCHAR(100),
    action        VARCHAR(50)  NOT NULL,
    actor_type    VARCHAR(20)  NOT NULL,
    actor_id      VARCHAR(100),
    actor_display VARCHAR(255),
    before_state  JSONB,
    after_state   JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
