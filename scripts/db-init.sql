-- Runs once on first Docker startup (docker-entrypoint-initdb.d)
-- Also run directly via NpgsqlCommand in Testcontainers for integration tests.
-- Uses only simple SQL (no PL/pgSQL functions) for cross-driver compatibility.
-- All INSERTs use ON CONFLICT … DO NOTHING for full idempotency.

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

CREATE TABLE IF NOT EXISTS public.managers (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    is_super_admin BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.manager_tenants (
    manager_id UUID NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE,
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL DEFAULT 'Owner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (manager_id, tenant_id)
);

-- ── Tenants ────────────────────────────────────────────────────────────────────

INSERT INTO public.tenants (slug, schema_name, name)
VALUES ('cafetunisia', 'cafetunisia', 'Café Tunisia')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tenants (slug, schema_name, name)
VALUES ('restauranttunisia', 'restauranttunisia', 'Restaurant Tunisia')
ON CONFLICT (slug) DO NOTHING;

-- ── Manager accounts ──────────────────────────────────────────────────────────
-- All passwords: mehdi123
-- Hash: v1:yBlvQEuHLrESSCiKbP1bug==:cTBvblA+3YxUuFTvD/40bsEPPmMc7PZ3RACPxYpstMs=

-- Super admin  →  /admin/login
INSERT INTO public.managers (id, email, password_hash, display_name, is_super_admin, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'mehdi@mehdi.com',
    'v1:yBlvQEuHLrESSCiKbP1bug==:cTBvblA+3YxUuFTvD/40bsEPPmMc7PZ3RACPxYpstMs=',
    'Mehdi (Super Admin)',
    true, true, NOW(), NOW()
)
ON CONFLICT (email) DO NOTHING;

-- cafetunisia manager  →  /login  (tenant: cafetunisia)
INSERT INTO public.managers (id, email, password_hash, display_name, is_super_admin, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'mehdi@cafetunisia.com',
    'v1:yBlvQEuHLrESSCiKbP1bug==:cTBvblA+3YxUuFTvD/40bsEPPmMc7PZ3RACPxYpstMs=',
    'Mehdi (Café Tunisia)',
    false, true, NOW(), NOW()
)
ON CONFLICT (email) DO NOTHING;

-- restauranttunisia manager  →  /login  (tenant: restauranttunisia)
INSERT INTO public.managers (id, email, password_hash, display_name, is_super_admin, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    'mehdi@restauranttunisia.com',
    'v1:yBlvQEuHLrESSCiKbP1bug==:cTBvblA+3YxUuFTvD/40bsEPPmMc7PZ3RACPxYpstMs=',
    'Mehdi (Restaurant Tunisia)',
    false, true, NOW(), NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Manager → tenant links
INSERT INTO public.manager_tenants (manager_id, tenant_id, role, created_at)
SELECT '00000000-0000-0000-0000-000000000001', t.id, 'Owner', NOW()
FROM public.tenants t WHERE t.slug = 'cafetunisia'
ON CONFLICT (manager_id, tenant_id) DO NOTHING;

INSERT INTO public.manager_tenants (manager_id, tenant_id, role, created_at)
SELECT '00000000-0000-0000-0000-000000000003', t.id, 'Owner', NOW()
FROM public.tenants t WHERE t.slug = 'restauranttunisia'
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

-- ── cafetunisia seed data ──────────────────────────────────────────────────────

INSERT INTO cafetunisia.configs (key, value) VALUES
    ('restaurant_name', 'Café Tunisia'),
    ('tva_rate',        '7'),
    ('language',        'FR'),
    ('opening_hours',   '{"mon":{"open":"07:00","close":"22:00"},"tue":{"open":"07:00","close":"22:00"},"wed":{"open":"07:00","close":"22:00"},"thu":{"open":"07:00","close":"22:00"},"fri":{"open":"07:00","close":"22:00"},"sat":{"open":"08:00","close":"23:00"},"sun":{"open":"08:00","close":"22:00"}}')
ON CONFLICT (key) DO NOTHING;

-- Spaces
INSERT INTO cafetunisia.spaces (id, name, cols, rows, sort_order) VALUES
    ('cafe0001-0000-0000-0000-000000000001', 'Salle intérieure', 3, 3, 0),
    ('cafe0001-0000-0000-0000-000000000002', 'Terrasse',         3, 2, 1)
ON CONFLICT (id) DO NOTHING;

-- Tables — Salle intérieure (3×3 = 9 tables)
INSERT INTO cafetunisia.tables (id, space_id, number, col, row, qr_token) VALUES
    ('cafe0002-0000-0000-0000-000000000001','cafe0001-0000-0000-0000-000000000001','1',0,0,'cafe00qr-0000-0000-0000-000000000001'),
    ('cafe0002-0000-0000-0000-000000000002','cafe0001-0000-0000-0000-000000000001','2',1,0,'cafe00qr-0000-0000-0000-000000000002'),
    ('cafe0002-0000-0000-0000-000000000003','cafe0001-0000-0000-0000-000000000001','3',2,0,'cafe00qr-0000-0000-0000-000000000003'),
    ('cafe0002-0000-0000-0000-000000000004','cafe0001-0000-0000-0000-000000000001','4',0,1,'cafe00qr-0000-0000-0000-000000000004'),
    ('cafe0002-0000-0000-0000-000000000005','cafe0001-0000-0000-0000-000000000001','5',1,1,'cafe00qr-0000-0000-0000-000000000005'),
    ('cafe0002-0000-0000-0000-000000000006','cafe0001-0000-0000-0000-000000000001','6',2,1,'cafe00qr-0000-0000-0000-000000000006'),
    ('cafe0002-0000-0000-0000-000000000007','cafe0001-0000-0000-0000-000000000001','7',0,2,'cafe00qr-0000-0000-0000-000000000007'),
    ('cafe0002-0000-0000-0000-000000000008','cafe0001-0000-0000-0000-000000000001','8',1,2,'cafe00qr-0000-0000-0000-000000000008'),
    ('cafe0002-0000-0000-0000-000000000009','cafe0001-0000-0000-0000-000000000001','9',2,2,'cafe00qr-0000-0000-0000-000000000009')
ON CONFLICT (id) DO NOTHING;

-- Tables — Terrasse (3×2 = 6 tables)
INSERT INTO cafetunisia.tables (id, space_id, number, col, row, qr_token) VALUES
    ('cafe0002-0000-0000-0000-000000000010','cafe0001-0000-0000-0000-000000000002','T1',0,0,'cafe00qr-0000-0000-0000-000000000010'),
    ('cafe0002-0000-0000-0000-000000000011','cafe0001-0000-0000-0000-000000000002','T2',1,0,'cafe00qr-0000-0000-0000-000000000011'),
    ('cafe0002-0000-0000-0000-000000000012','cafe0001-0000-0000-0000-000000000002','T3',2,0,'cafe00qr-0000-0000-0000-000000000012'),
    ('cafe0002-0000-0000-0000-000000000013','cafe0001-0000-0000-0000-000000000002','T4',0,1,'cafe00qr-0000-0000-0000-000000000013'),
    ('cafe0002-0000-0000-0000-000000000014','cafe0001-0000-0000-0000-000000000002','T5',1,1,'cafe00qr-0000-0000-0000-000000000014'),
    ('cafe0002-0000-0000-0000-000000000015','cafe0001-0000-0000-0000-000000000002','T6',2,1,'cafe00qr-0000-0000-0000-000000000015')
ON CONFLICT (id) DO NOTHING;

-- Staff  (PINs: Ahmed=1234, Fatma=2222, Omar=3333)
INSERT INTO cafetunisia.staff (id, display_name, role, pin_hash) VALUES
    ('cafe0003-0000-0000-0000-000000000001','Ahmed','Waiter', '$2b$10$5mTNLrRQrEZpDFpbrUkjZuCs90KDk.dlH0KUAdWwQAuJbCVJ38C.S'),
    ('cafe0003-0000-0000-0000-000000000002','Fatma','Kitchen','$2b$10$DN.wE0mP2TcB0p3bYOw8/eY7u1Q9VUQoqgPcrwDYgAd84tayRGkge'),
    ('cafe0003-0000-0000-0000-000000000003','Omar', 'Cashier','$2b$10$5bDnt9uaS0Gc2RLBeSdRzefKS0xtYVLjJiVWkNKxdQ.yDZGyhxKC2')
ON CONFLICT (id) DO NOTHING;

-- Waiter zone: Ahmed covers all of Salle intérieure
INSERT INTO cafetunisia.waiter_zones (id, staff_id, space_id, col_start, col_end, row_start, row_end) VALUES
    ('cafe00wz-0000-0000-0000-000000000001','cafe0003-0000-0000-0000-000000000001','cafe0001-0000-0000-0000-000000000001',0,2,0,2)
ON CONFLICT (id) DO NOTHING;

-- Categories
INSERT INTO cafetunisia.categories (id, name, sort_order) VALUES
    ('cafe0004-0000-0000-0000-000000000001','Boissons',0),
    ('cafe0004-0000-0000-0000-000000000002','Snacks',  1)
ON CONFLICT (id) DO NOTHING;

-- Menu items — Boissons
INSERT INTO cafetunisia.menu_items (id, category_id, name, description, price, sort_order) VALUES
    ('cafe0005-0000-0000-0000-000000000001','cafe0004-0000-0000-0000-000000000001','Café',          'Espresso serré tunisien',          1.500, 0),
    ('cafe0005-0000-0000-0000-000000000002','cafe0004-0000-0000-0000-000000000001','Thé à la Menthe','Thé vert à la menthe fraîche',      1.200, 1),
    ('cafe0005-0000-0000-0000-000000000003','cafe0004-0000-0000-0000-000000000001','Cappuccino',    'Café crémeux avec mousse de lait',  2.500, 2),
    ('cafe0005-0000-0000-0000-000000000004','cafe0004-0000-0000-0000-000000000001','Jus d''Orange', 'Pressé à la commande',              2.500, 3),
    ('cafe0005-0000-0000-0000-000000000005','cafe0004-0000-0000-0000-000000000001','Coca-Cola',     'Boisson fraîche 33cl',              2.000, 4)
ON CONFLICT (id) DO NOTHING;

-- Menu items — Snacks
INSERT INTO cafetunisia.menu_items (id, category_id, name, description, price, sort_order) VALUES
    ('cafe0005-0000-0000-0000-000000000006','cafe0004-0000-0000-0000-000000000002','Croissant',     'Croissant pur beurre',              1.800, 0),
    ('cafe0005-0000-0000-0000-000000000007','cafe0004-0000-0000-0000-000000000002','Sandwich',      'Baguette thon-harissa-câpres',      4.500, 1),
    ('cafe0005-0000-0000-0000-000000000008','cafe0004-0000-0000-0000-000000000002','Salade Fraîche','Tomates, concombre, olives',        3.500, 2)
ON CONFLICT (id) DO NOTHING;

-- Modifier group on Café: Sucre
INSERT INTO cafetunisia.modifier_groups (id, menu_item_id, name, is_required, min_selections, max_selections) VALUES
    ('cafe00mg-0000-0000-0000-000000000001','cafe0005-0000-0000-0000-000000000001','Sucre',true,1,1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cafetunisia.modifier_options (id, modifier_group_id, name, price_delta, sort_order) VALUES
    ('cafe00mo-0000-0000-0000-000000000001','cafe00mg-0000-0000-0000-000000000001','Sans sucre',  0.000, 0),
    ('cafe00mo-0000-0000-0000-000000000002','cafe00mg-0000-0000-0000-000000000001','Un sucre',    0.000, 1),
    ('cafe00mo-0000-0000-0000-000000000003','cafe00mg-0000-0000-0000-000000000001','Deux sucres', 0.000, 2)
ON CONFLICT (id) DO NOTHING;

-- Historical session + order (for dashboard KPIs)
INSERT INTO cafetunisia.table_sessions (id, table_id, staff_id, opened_at, closed_at) VALUES
    ('cafe0006-0000-0000-0000-000000000001',
     'cafe0002-0000-0000-0000-000000000001',
     'cafe0003-0000-0000-0000-000000000001',
     NOW() - INTERVAL '2 hours',
     NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cafetunisia.orders (id, table_id, session_id, order_type, status, created_at, updated_at) VALUES
    ('cafe0007-0000-0000-0000-000000000001',
     'cafe0002-0000-0000-0000-000000000001',
     'cafe0006-0000-0000-0000-000000000001',
     'DineIn','Completed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cafetunisia.order_items (id, order_id, menu_item_id, menu_item_name, unit_price, quantity) VALUES
    ('cafe00oi-0000-0000-0000-000000000001','cafe0007-0000-0000-0000-000000000001','cafe0005-0000-0000-0000-000000000001','Café',     1.500, 2),
    ('cafe00oi-0000-0000-0000-000000000002','cafe0007-0000-0000-0000-000000000001','cafe0005-0000-0000-0000-000000000006','Croissant',1.800, 1)
ON CONFLICT (id) DO NOTHING;

-- Additional historical sessions (12 sessions spread over 28 days — dashboard chart)
INSERT INTO cafetunisia.table_sessions (id, table_id, staff_id, opened_at, closed_at) VALUES
    ('cafe0006-0000-0000-0000-000000000002','cafe0002-0000-0000-0000-000000000002','cafe0003-0000-0000-0000-000000000003',NOW()-INTERVAL '2 days', NOW()-INTERVAL '2 days'+INTERVAL '90 min'),
    ('cafe0006-0000-0000-0000-000000000003','cafe0002-0000-0000-0000-000000000005','cafe0003-0000-0000-0000-000000000001',NOW()-INTERVAL '4 days', NOW()-INTERVAL '4 days'+INTERVAL '60 min'),
    ('cafe0006-0000-0000-0000-000000000004','cafe0002-0000-0000-0000-000000000003','cafe0003-0000-0000-0000-000000000003',NOW()-INTERVAL '5 days', NOW()-INTERVAL '5 days'+INTERVAL '45 min'),
    ('cafe0006-0000-0000-0000-000000000005','cafe0002-0000-0000-0000-000000000007','cafe0003-0000-0000-0000-000000000001',NOW()-INTERVAL '7 days', NOW()-INTERVAL '7 days'+INTERVAL '80 min'),
    ('cafe0006-0000-0000-0000-000000000006','cafe0002-0000-0000-0000-000000000001','cafe0003-0000-0000-0000-000000000003',NOW()-INTERVAL '8 days', NOW()-INTERVAL '8 days'+INTERVAL '50 min'),
    ('cafe0006-0000-0000-0000-000000000007','cafe0002-0000-0000-0000-000000000004','cafe0003-0000-0000-0000-000000000001',NOW()-INTERVAL '10 days',NOW()-INTERVAL '10 days'+INTERVAL '70 min'),
    ('cafe0006-0000-0000-0000-000000000008','cafe0002-0000-0000-0000-000000000010','cafe0003-0000-0000-0000-000000000003',NOW()-INTERVAL '12 days',NOW()-INTERVAL '12 days'+INTERVAL '55 min'),
    ('cafe0006-0000-0000-0000-000000000009','cafe0002-0000-0000-0000-000000000011','cafe0003-0000-0000-0000-000000000001',NOW()-INTERVAL '14 days',NOW()-INTERVAL '14 days'+INTERVAL '65 min'),
    ('cafe0006-0000-0000-0000-000000000010','cafe0002-0000-0000-0000-000000000002','cafe0003-0000-0000-0000-000000000003',NOW()-INTERVAL '17 days',NOW()-INTERVAL '17 days'+INTERVAL '45 min'),
    ('cafe0006-0000-0000-0000-000000000011','cafe0002-0000-0000-0000-000000000006','cafe0003-0000-0000-0000-000000000001',NOW()-INTERVAL '20 days',NOW()-INTERVAL '20 days'+INTERVAL '90 min'),
    ('cafe0006-0000-0000-0000-000000000012','cafe0002-0000-0000-0000-000000000012','cafe0003-0000-0000-0000-000000000003',NOW()-INTERVAL '24 days',NOW()-INTERVAL '24 days'+INTERVAL '60 min'),
    ('cafe0006-0000-0000-0000-000000000013','cafe0002-0000-0000-0000-000000000008','cafe0003-0000-0000-0000-000000000001',NOW()-INTERVAL '27 days',NOW()-INTERVAL '27 days'+INTERVAL '50 min')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cafetunisia.orders (id, table_id, session_id, order_type, status, created_at, updated_at) VALUES
    ('cafe0007-0000-0000-0000-000000000002','cafe0002-0000-0000-0000-000000000002','cafe0006-0000-0000-0000-000000000002','DineIn','Completed',NOW()-INTERVAL '2 days', NOW()-INTERVAL '2 days'),
    ('cafe0007-0000-0000-0000-000000000003','cafe0002-0000-0000-0000-000000000005','cafe0006-0000-0000-0000-000000000003','DineIn','Completed',NOW()-INTERVAL '4 days', NOW()-INTERVAL '4 days'),
    ('cafe0007-0000-0000-0000-000000000004','cafe0002-0000-0000-0000-000000000003','cafe0006-0000-0000-0000-000000000004','DineIn','Completed',NOW()-INTERVAL '5 days', NOW()-INTERVAL '5 days'),
    ('cafe0007-0000-0000-0000-000000000005','cafe0002-0000-0000-0000-000000000007','cafe0006-0000-0000-0000-000000000005','DineIn','Completed',NOW()-INTERVAL '7 days', NOW()-INTERVAL '7 days'),
    ('cafe0007-0000-0000-0000-000000000006','cafe0002-0000-0000-0000-000000000001','cafe0006-0000-0000-0000-000000000006','DineIn','Completed',NOW()-INTERVAL '8 days', NOW()-INTERVAL '8 days'),
    ('cafe0007-0000-0000-0000-000000000007','cafe0002-0000-0000-0000-000000000004','cafe0006-0000-0000-0000-000000000007','DineIn','Completed',NOW()-INTERVAL '10 days',NOW()-INTERVAL '10 days'),
    ('cafe0007-0000-0000-0000-000000000008','cafe0002-0000-0000-0000-000000000010','cafe0006-0000-0000-0000-000000000008','DineIn','Completed',NOW()-INTERVAL '12 days',NOW()-INTERVAL '12 days'),
    ('cafe0007-0000-0000-0000-000000000009','cafe0002-0000-0000-0000-000000000011','cafe0006-0000-0000-0000-000000000009','DineIn','Completed',NOW()-INTERVAL '14 days',NOW()-INTERVAL '14 days'),
    ('cafe0007-0000-0000-0000-000000000010','cafe0002-0000-0000-0000-000000000002','cafe0006-0000-0000-0000-000000000010','DineIn','Completed',NOW()-INTERVAL '17 days',NOW()-INTERVAL '17 days'),
    ('cafe0007-0000-0000-0000-000000000011','cafe0002-0000-0000-0000-000000000006','cafe0006-0000-0000-0000-000000000011','DineIn','Completed',NOW()-INTERVAL '20 days',NOW()-INTERVAL '20 days'),
    ('cafe0007-0000-0000-0000-000000000012','cafe0002-0000-0000-0000-000000000012','cafe0006-0000-0000-0000-000000000012','DineIn','Completed',NOW()-INTERVAL '24 days',NOW()-INTERVAL '24 days'),
    ('cafe0007-0000-0000-0000-000000000013','cafe0002-0000-0000-0000-000000000008','cafe0006-0000-0000-0000-000000000013','DineIn','Completed',NOW()-INTERVAL '27 days',NOW()-INTERVAL '27 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cafetunisia.order_items (id, order_id, menu_item_id, menu_item_name, unit_price, quantity) VALUES
    ('cafe00oi-0000-0000-0000-000000000003','cafe0007-0000-0000-0000-000000000002','cafe0005-0000-0000-0000-000000000001','Café',           1.500, 2),
    ('cafe00oi-0000-0000-0000-000000000004','cafe0007-0000-0000-0000-000000000002','cafe0005-0000-0000-0000-000000000006','Croissant',      1.800, 2),
    ('cafe00oi-0000-0000-0000-000000000005','cafe0007-0000-0000-0000-000000000003','cafe0005-0000-0000-0000-000000000002','Thé à la Menthe',1.200, 2),
    ('cafe00oi-0000-0000-0000-000000000006','cafe0007-0000-0000-0000-000000000003','cafe0005-0000-0000-0000-000000000007','Sandwich',       4.500, 1),
    ('cafe00oi-0000-0000-0000-000000000007','cafe0007-0000-0000-0000-000000000004','cafe0005-0000-0000-0000-000000000003','Cappuccino',     2.500, 2),
    ('cafe00oi-0000-0000-0000-000000000008','cafe0007-0000-0000-0000-000000000004','cafe0005-0000-0000-0000-000000000006','Croissant',      1.800, 2),
    ('cafe00oi-0000-0000-0000-000000000009','cafe0007-0000-0000-0000-000000000005','cafe0005-0000-0000-0000-000000000004','Jus d''Orange',  2.500, 2),
    ('cafe00oi-0000-0000-0000-000000000010','cafe0007-0000-0000-0000-000000000005','cafe0005-0000-0000-0000-000000000007','Sandwich',       4.500, 2),
    ('cafe00oi-0000-0000-0000-000000000011','cafe0007-0000-0000-0000-000000000006','cafe0005-0000-0000-0000-000000000001','Café',           1.500, 3),
    ('cafe00oi-0000-0000-0000-000000000012','cafe0007-0000-0000-0000-000000000006','cafe0005-0000-0000-0000-000000000008','Salade Fraîche', 3.500, 1),
    ('cafe00oi-0000-0000-0000-000000000013','cafe0007-0000-0000-0000-000000000007','cafe0005-0000-0000-0000-000000000002','Thé à la Menthe',1.200, 3),
    ('cafe00oi-0000-0000-0000-000000000014','cafe0007-0000-0000-0000-000000000007','cafe0005-0000-0000-0000-000000000006','Croissant',      1.800, 3),
    ('cafe00oi-0000-0000-0000-000000000015','cafe0007-0000-0000-0000-000000000008','cafe0005-0000-0000-0000-000000000003','Cappuccino',     2.500, 1),
    ('cafe00oi-0000-0000-0000-000000000016','cafe0007-0000-0000-0000-000000000008','cafe0005-0000-0000-0000-000000000007','Sandwich',       4.500, 1),
    ('cafe00oi-0000-0000-0000-000000000017','cafe0007-0000-0000-0000-000000000009','cafe0005-0000-0000-0000-000000000005','Coca-Cola',      2.000, 2),
    ('cafe00oi-0000-0000-0000-000000000018','cafe0007-0000-0000-0000-000000000009','cafe0005-0000-0000-0000-000000000007','Sandwich',       4.500, 2),
    ('cafe00oi-0000-0000-0000-000000000019','cafe0007-0000-0000-0000-000000000010','cafe0005-0000-0000-0000-000000000001','Café',           1.500, 2),
    ('cafe00oi-0000-0000-0000-000000000020','cafe0007-0000-0000-0000-000000000010','cafe0005-0000-0000-0000-000000000008','Salade Fraîche', 3.500, 1),
    ('cafe00oi-0000-0000-0000-000000000021','cafe0007-0000-0000-0000-000000000011','cafe0005-0000-0000-0000-000000000004','Jus d''Orange',  2.500, 2),
    ('cafe00oi-0000-0000-0000-000000000022','cafe0007-0000-0000-0000-000000000011','cafe0005-0000-0000-0000-000000000006','Croissant',      1.800, 2),
    ('cafe00oi-0000-0000-0000-000000000023','cafe0007-0000-0000-0000-000000000012','cafe0005-0000-0000-0000-000000000002','Thé à la Menthe',1.200, 2),
    ('cafe00oi-0000-0000-0000-000000000024','cafe0007-0000-0000-0000-000000000012','cafe0005-0000-0000-0000-000000000007','Sandwich',       4.500, 1),
    ('cafe00oi-0000-0000-0000-000000000025','cafe0007-0000-0000-0000-000000000013','cafe0005-0000-0000-0000-000000000001','Café',           1.500, 4),
    ('cafe00oi-0000-0000-0000-000000000026','cafe0007-0000-0000-0000-000000000013','cafe0005-0000-0000-0000-000000000006','Croissant',      1.800, 2)
ON CONFLICT (id) DO NOTHING;

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

-- ── restauranttunisia seed data ────────────────────────────────────────────────

INSERT INTO restauranttunisia.configs (key, value) VALUES
    ('restaurant_name', 'Restaurant Tunisia'),
    ('tva_rate',        '19'),
    ('language',        'FR'),
    ('opening_hours',   '{"mon":null,"tue":{"open":"12:00","close":"23:00"},"wed":{"open":"12:00","close":"23:00"},"thu":{"open":"12:00","close":"23:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"11:00","close":"23:30"},"sun":{"open":"11:00","close":"23:00"}}')
ON CONFLICT (key) DO NOTHING;

-- Spaces
INSERT INTO restauranttunisia.spaces (id, name, cols, rows, sort_order) VALUES
    ('rest0001-0000-0000-0000-000000000001','Salle Principale',4,4,0),
    ('rest0001-0000-0000-0000-000000000002','Terrasse',        3,3,1),
    ('rest0001-0000-0000-0000-000000000003','Bar',             2,3,2)
ON CONFLICT (id) DO NOTHING;

-- Tables — Salle Principale (4×4 = 16 tables)
INSERT INTO restauranttunisia.tables (id, space_id, number, col, row, qr_token) VALUES
    ('rest0002-0000-0000-0000-000000000001','rest0001-0000-0000-0000-000000000001','1', 0,0,'rest00qr-0000-0000-0000-000000000001'),
    ('rest0002-0000-0000-0000-000000000002','rest0001-0000-0000-0000-000000000001','2', 1,0,'rest00qr-0000-0000-0000-000000000002'),
    ('rest0002-0000-0000-0000-000000000003','rest0001-0000-0000-0000-000000000001','3', 2,0,'rest00qr-0000-0000-0000-000000000003'),
    ('rest0002-0000-0000-0000-000000000004','rest0001-0000-0000-0000-000000000001','4', 3,0,'rest00qr-0000-0000-0000-000000000004'),
    ('rest0002-0000-0000-0000-000000000005','rest0001-0000-0000-0000-000000000001','5', 0,1,'rest00qr-0000-0000-0000-000000000005'),
    ('rest0002-0000-0000-0000-000000000006','rest0001-0000-0000-0000-000000000001','6', 1,1,'rest00qr-0000-0000-0000-000000000006'),
    ('rest0002-0000-0000-0000-000000000007','rest0001-0000-0000-0000-000000000001','7', 2,1,'rest00qr-0000-0000-0000-000000000007'),
    ('rest0002-0000-0000-0000-000000000008','rest0001-0000-0000-0000-000000000001','8', 3,1,'rest00qr-0000-0000-0000-000000000008'),
    ('rest0002-0000-0000-0000-000000000009','rest0001-0000-0000-0000-000000000001','9', 0,2,'rest00qr-0000-0000-0000-000000000009'),
    ('rest0002-0000-0000-0000-000000000010','rest0001-0000-0000-0000-000000000001','10',1,2,'rest00qr-0000-0000-0000-000000000010'),
    ('rest0002-0000-0000-0000-000000000011','rest0001-0000-0000-0000-000000000001','11',2,2,'rest00qr-0000-0000-0000-000000000011'),
    ('rest0002-0000-0000-0000-000000000012','rest0001-0000-0000-0000-000000000001','12',3,2,'rest00qr-0000-0000-0000-000000000012'),
    ('rest0002-0000-0000-0000-000000000013','rest0001-0000-0000-0000-000000000001','13',0,3,'rest00qr-0000-0000-0000-000000000013'),
    ('rest0002-0000-0000-0000-000000000014','rest0001-0000-0000-0000-000000000001','14',1,3,'rest00qr-0000-0000-0000-000000000014'),
    ('rest0002-0000-0000-0000-000000000015','rest0001-0000-0000-0000-000000000001','15',2,3,'rest00qr-0000-0000-0000-000000000015'),
    ('rest0002-0000-0000-0000-000000000016','rest0001-0000-0000-0000-000000000001','16',3,3,'rest00qr-0000-0000-0000-000000000016')
ON CONFLICT (id) DO NOTHING;

-- Tables — Terrasse (3×3 = 9 tables)
INSERT INTO restauranttunisia.tables (id, space_id, number, col, row, qr_token) VALUES
    ('rest0002-0000-0000-0000-000000000017','rest0001-0000-0000-0000-000000000002','T1',0,0,'rest00qr-0000-0000-0000-000000000017'),
    ('rest0002-0000-0000-0000-000000000018','rest0001-0000-0000-0000-000000000002','T2',1,0,'rest00qr-0000-0000-0000-000000000018'),
    ('rest0002-0000-0000-0000-000000000019','rest0001-0000-0000-0000-000000000002','T3',2,0,'rest00qr-0000-0000-0000-000000000019'),
    ('rest0002-0000-0000-0000-000000000020','rest0001-0000-0000-0000-000000000002','T4',0,1,'rest00qr-0000-0000-0000-000000000020'),
    ('rest0002-0000-0000-0000-000000000021','rest0001-0000-0000-0000-000000000002','T5',1,1,'rest00qr-0000-0000-0000-000000000021'),
    ('rest0002-0000-0000-0000-000000000022','rest0001-0000-0000-0000-000000000002','T6',2,1,'rest00qr-0000-0000-0000-000000000022'),
    ('rest0002-0000-0000-0000-000000000023','rest0001-0000-0000-0000-000000000002','T7',0,2,'rest00qr-0000-0000-0000-000000000023'),
    ('rest0002-0000-0000-0000-000000000024','rest0001-0000-0000-0000-000000000002','T8',1,2,'rest00qr-0000-0000-0000-000000000024'),
    ('rest0002-0000-0000-0000-000000000025','rest0001-0000-0000-0000-000000000002','T9',2,2,'rest00qr-0000-0000-0000-000000000025')
ON CONFLICT (id) DO NOTHING;

-- Tables — Bar (2×3 = 6 tables)
INSERT INTO restauranttunisia.tables (id, space_id, number, col, row, qr_token) VALUES
    ('rest0002-0000-0000-0000-000000000026','rest0001-0000-0000-0000-000000000003','B1',0,0,'rest00qr-0000-0000-0000-000000000026'),
    ('rest0002-0000-0000-0000-000000000027','rest0001-0000-0000-0000-000000000003','B2',1,0,'rest00qr-0000-0000-0000-000000000027'),
    ('rest0002-0000-0000-0000-000000000028','rest0001-0000-0000-0000-000000000003','B3',0,1,'rest00qr-0000-0000-0000-000000000028'),
    ('rest0002-0000-0000-0000-000000000029','rest0001-0000-0000-0000-000000000003','B4',1,1,'rest00qr-0000-0000-0000-000000000029'),
    ('rest0002-0000-0000-0000-000000000030','rest0001-0000-0000-0000-000000000003','B5',0,2,'rest00qr-0000-0000-0000-000000000030'),
    ('rest0002-0000-0000-0000-000000000031','rest0001-0000-0000-0000-000000000003','B6',1,2,'rest00qr-0000-0000-0000-000000000031')
ON CONFLICT (id) DO NOTHING;

-- Staff  (PINs: Karim=1234, Sana=2222, Bilel=3333, Chef Amine=4444)
INSERT INTO restauranttunisia.staff (id, display_name, role, pin_hash) VALUES
    ('rest0003-0000-0000-0000-000000000001','Karim',      'Waiter', '$2b$10$5mTNLrRQrEZpDFpbrUkjZuCs90KDk.dlH0KUAdWwQAuJbCVJ38C.S'),
    ('rest0003-0000-0000-0000-000000000002','Sana',       'Kitchen','$2b$10$DN.wE0mP2TcB0p3bYOw8/eY7u1Q9VUQoqgPcrwDYgAd84tayRGkge'),
    ('rest0003-0000-0000-0000-000000000003','Bilel',      'Cashier','$2b$10$5bDnt9uaS0Gc2RLBeSdRzefKS0xtYVLjJiVWkNKxdQ.yDZGyhxKC2'),
    ('rest0003-0000-0000-0000-000000000004','Chef Amine', 'Kitchen','$2b$10$.Uj8DxwGA2bDgQDbjrmKtujXioG15m5sW65u2F6.DEzuVi4X8/8VW')
ON CONFLICT (id) DO NOTHING;

-- Waiter zone: Karim covers all of Salle Principale
INSERT INTO restauranttunisia.waiter_zones (id, staff_id, space_id, col_start, col_end, row_start, row_end) VALUES
    ('rest00wz-0000-0000-0000-000000000001','rest0003-0000-0000-0000-000000000001','rest0001-0000-0000-0000-000000000001',0,3,0,3)
ON CONFLICT (id) DO NOTHING;

-- Categories
INSERT INTO restauranttunisia.categories (id, name, sort_order) VALUES
    ('rest0004-0000-0000-0000-000000000001','Entrées',          0),
    ('rest0004-0000-0000-0000-000000000002','Plats Principaux', 1),
    ('rest0004-0000-0000-0000-000000000003','Boissons',         2),
    ('rest0004-0000-0000-0000-000000000004','Desserts',         3),
    ('rest0004-0000-0000-0000-000000000005','Spécialités',      4)
ON CONFLICT (id) DO NOTHING;

-- Menu items — Entrées
INSERT INTO restauranttunisia.menu_items (id, category_id, name, description, price, sort_order) VALUES
    ('rest0005-0000-0000-0000-000000000001','rest0004-0000-0000-0000-000000000001','Brick à l''œuf',   'Fine pâte croustillante fourrée d''œuf, thon et câpres', 5.500, 0),
    ('rest0005-0000-0000-0000-000000000002','rest0004-0000-0000-0000-000000000001','Salade Mechouia',  'Poivrons et tomates grillés à l''huile d''olive',        4.500, 1),
    ('rest0005-0000-0000-0000-000000000003','rest0004-0000-0000-0000-000000000001','Chorba Frik',      'Soupe traditionnelle aux céréales et viande',            6.000, 2),
    ('rest0005-0000-0000-0000-000000000004','rest0004-0000-0000-0000-000000000001','Harissa Maison',   'Sauce épicée tunisienne artisanale',                     2.000, 3)
ON CONFLICT (id) DO NOTHING;

-- Menu items — Plats Principaux
INSERT INTO restauranttunisia.menu_items (id, category_id, name, description, price, sort_order) VALUES
    ('rest0005-0000-0000-0000-000000000005','rest0004-0000-0000-0000-000000000002','Couscous Agneau',  'Couscous traditionnel avec légumes du marché',           18.000,0),
    ('rest0005-0000-0000-0000-000000000006','rest0004-0000-0000-0000-000000000002','Tajine Poulet',    'Tajine mijoté aux olives et citron confit',              15.000,1),
    ('rest0005-0000-0000-0000-000000000007','rest0004-0000-0000-0000-000000000002','Kafteji',          'Légumes frits aux œufs, plat populaire tunisien',        13.000,2),
    ('rest0005-0000-0000-0000-000000000008','rest0004-0000-0000-0000-000000000002','Ojja Merguez',     'Œufs brouillés aux merguez et harissa',                  14.000,3),
    ('rest0005-0000-0000-0000-000000000009','rest0004-0000-0000-0000-000000000002','Poisson du Jour',  'Poisson frais grillé avec salade tunisienne',            22.000,4),
    ('rest0005-0000-0000-0000-000000000010','rest0004-0000-0000-0000-000000000002','Assiette Merguez', 'Merguez grillées au feu de bois avec frites',            16.000,5)
ON CONFLICT (id) DO NOTHING;

-- Menu items — Boissons
INSERT INTO restauranttunisia.menu_items (id, category_id, name, description, price, sort_order) VALUES
    ('rest0005-0000-0000-0000-000000000011','rest0004-0000-0000-0000-000000000003','Thé à la Menthe',  'Thé vert traditionnel à la menthe fraîche',              2.500, 0),
    ('rest0005-0000-0000-0000-000000000012','rest0004-0000-0000-0000-000000000003','Café Arabica',     'Café fort à l''orientale',                               2.000, 1),
    ('rest0005-0000-0000-0000-000000000013','rest0004-0000-0000-0000-000000000003','Jus de Grenade',   'Jus frais pressé',                                       4.500, 2),
    ('rest0005-0000-0000-0000-000000000014','rest0004-0000-0000-0000-000000000003','Lben',             'Lait fermenté traditionnel',                             2.000, 3),
    ('rest0005-0000-0000-0000-000000000015','rest0004-0000-0000-0000-000000000003','Eau Minérale',     '',                                                       1.500, 4),
    ('rest0005-0000-0000-0000-000000000016','rest0004-0000-0000-0000-000000000003','Boisson Fraîche',  'Coca-Cola, Sprite ou Fanta',                             3.000, 5)
ON CONFLICT (id) DO NOTHING;

-- Menu items — Desserts
INSERT INTO restauranttunisia.menu_items (id, category_id, name, description, price, sort_order) VALUES
    ('rest0005-0000-0000-0000-000000000017','rest0004-0000-0000-0000-000000000004','Makroudh',         'Gâteau semoule fourré aux dattes',                       4.500, 0),
    ('rest0005-0000-0000-0000-000000000018','rest0004-0000-0000-0000-000000000004','Baklawa',          'Feuilletage au miel et pistaches',                       5.000, 1),
    ('rest0005-0000-0000-0000-000000000019','rest0004-0000-0000-0000-000000000004','Crème Caramel',    'Faite maison',                                           4.000, 2),
    ('rest0005-0000-0000-0000-000000000020','rest0004-0000-0000-0000-000000000004','Assortiment Oriental','Sélection de pâtisseries tunisiennes',                7.500, 3)
ON CONFLICT (id) DO NOTHING;

-- Menu items — Spécialités
INSERT INTO restauranttunisia.menu_items (id, category_id, name, description, price, sort_order) VALUES
    ('rest0005-0000-0000-0000-000000000021','rest0004-0000-0000-0000-000000000005','Lablabi',          'Soupe de pois chiches avec œuf et pain rassis',          8.000, 0),
    ('rest0005-0000-0000-0000-000000000022','rest0004-0000-0000-0000-000000000005','Fricassé',         'Sandwich tunisien au thon, olives et harissa',           6.500, 1),
    ('rest0005-0000-0000-0000-000000000023','rest0004-0000-0000-0000-000000000005','Assida',           'Purée de blé au beurre et miel',                         6.000, 2)
ON CONFLICT (id) DO NOTHING;

-- Modifier group on Couscous Agneau: type de viande
INSERT INTO restauranttunisia.modifier_groups (id, menu_item_id, name, is_required, min_selections, max_selections) VALUES
    ('rest00mg-0000-0000-0000-000000000001','rest0005-0000-0000-0000-000000000005','Type de viande',true,1,1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO restauranttunisia.modifier_options (id, modifier_group_id, name, price_delta, sort_order) VALUES
    ('rest00mo-0000-0000-0000-000000000001','rest00mg-0000-0000-0000-000000000001','Agneau',      0.000,0),
    ('rest00mo-0000-0000-0000-000000000002','rest00mg-0000-0000-0000-000000000001','Poulet',     -2.000,1),
    ('rest00mo-0000-0000-0000-000000000003','rest00mg-0000-0000-0000-000000000001','Végétarien', -4.000,2)
ON CONFLICT (id) DO NOTHING;

-- Historical sessions + orders
INSERT INTO restauranttunisia.table_sessions (id, table_id, staff_id, opened_at, closed_at) VALUES
    ('rest0006-0000-0000-0000-000000000001',
     'rest0002-0000-0000-0000-000000000001',
     'rest0003-0000-0000-0000-000000000001',
     NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '2 hours'),
    ('rest0006-0000-0000-0000-000000000002',
     'rest0002-0000-0000-0000-000000000017',
     'rest0003-0000-0000-0000-000000000001',
     NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '3 hours'),
    ('rest0006-0000-0000-0000-000000000003',
     'rest0002-0000-0000-0000-000000000026',
     'rest0003-0000-0000-0000-000000000003',
     NOW() - INTERVAL '1 day',  NOW() - INTERVAL '1 day'  + INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO restauranttunisia.orders (id, table_id, session_id, order_type, status, created_at, updated_at) VALUES
    ('rest0007-0000-0000-0000-000000000001','rest0002-0000-0000-0000-000000000001','rest0006-0000-0000-0000-000000000001','DineIn','Completed',NOW()-INTERVAL '3 days',NOW()-INTERVAL '3 days'),
    ('rest0007-0000-0000-0000-000000000002','rest0002-0000-0000-0000-000000000001','rest0006-0000-0000-0000-000000000001','DineIn','Completed',NOW()-INTERVAL '3 days',NOW()-INTERVAL '3 days'),
    ('rest0007-0000-0000-0000-000000000003','rest0002-0000-0000-0000-000000000017','rest0006-0000-0000-0000-000000000002','DineIn','Completed',NOW()-INTERVAL '2 days',NOW()-INTERVAL '2 days'),
    ('rest0007-0000-0000-0000-000000000004','rest0002-0000-0000-0000-000000000026','rest0006-0000-0000-0000-000000000003','DineIn','Completed',NOW()-INTERVAL '1 day', NOW()-INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO restauranttunisia.order_items (id, order_id, menu_item_id, menu_item_name, unit_price, quantity) VALUES
    ('rest00oi-0000-0000-0000-000000000001','rest0007-0000-0000-0000-000000000001','rest0005-0000-0000-0000-000000000005','Couscous Agneau',18.000,1),
    ('rest00oi-0000-0000-0000-000000000002','rest0007-0000-0000-0000-000000000001','rest0005-0000-0000-0000-000000000011','Thé à la Menthe', 2.500,2),
    ('rest00oi-0000-0000-0000-000000000003','rest0007-0000-0000-0000-000000000002','rest0005-0000-0000-0000-000000000001','Brick à l''œuf',  5.500,2),
    ('rest00oi-0000-0000-0000-000000000004','rest0007-0000-0000-0000-000000000002','rest0005-0000-0000-0000-000000000013','Jus de Grenade',  4.500,1),
    ('rest00oi-0000-0000-0000-000000000005','rest0007-0000-0000-0000-000000000003','rest0005-0000-0000-0000-000000000006','Tajine Poulet',  15.000,2),
    ('rest00oi-0000-0000-0000-000000000006','rest0007-0000-0000-0000-000000000003','rest0005-0000-0000-0000-000000000012','Café Arabica',    2.000,2),
    ('rest00oi-0000-0000-0000-000000000007','rest0007-0000-0000-0000-000000000003','rest0005-0000-0000-0000-000000000017','Makroudh',        4.500,2),
    ('rest00oi-0000-0000-0000-000000000008','rest0007-0000-0000-0000-000000000004','rest0005-0000-0000-0000-000000000022','Fricassé',        6.500,3),
    ('rest00oi-0000-0000-0000-000000000009','rest0007-0000-0000-0000-000000000004','rest0005-0000-0000-0000-000000000016','Boisson Fraîche', 3.000,3)
ON CONFLICT (id) DO NOTHING;

-- Additional historical sessions (12 sessions spread over 28 days — dashboard chart)
INSERT INTO restauranttunisia.table_sessions (id, table_id, staff_id, opened_at, closed_at) VALUES
    ('rest0006-0000-0000-0000-000000000004','rest0002-0000-0000-0000-000000000003','rest0003-0000-0000-0000-000000000001',NOW()-INTERVAL '2 days', NOW()-INTERVAL '2 days'+INTERVAL '2 hours'),
    ('rest0006-0000-0000-0000-000000000005','rest0002-0000-0000-0000-000000000008','rest0003-0000-0000-0000-000000000003',NOW()-INTERVAL '3 days', NOW()-INTERVAL '3 days'+INTERVAL '90 min'),
    ('rest0006-0000-0000-0000-000000000006','rest0002-0000-0000-0000-000000000017','rest0003-0000-0000-0000-000000000001',NOW()-INTERVAL '5 days', NOW()-INTERVAL '5 days'+INTERVAL '2 hours'),
    ('rest0006-0000-0000-0000-000000000007','rest0002-0000-0000-0000-000000000020','rest0003-0000-0000-0000-000000000003',NOW()-INTERVAL '6 days', NOW()-INTERVAL '6 days'+INTERVAL '75 min'),
    ('rest0006-0000-0000-0000-000000000008','rest0002-0000-0000-0000-000000000005','rest0003-0000-0000-0000-000000000001',NOW()-INTERVAL '8 days', NOW()-INTERVAL '8 days'+INTERVAL '2 hours'),
    ('rest0006-0000-0000-0000-000000000009','rest0002-0000-0000-0000-000000000012','rest0003-0000-0000-0000-000000000003',NOW()-INTERVAL '9 days', NOW()-INTERVAL '9 days'+INTERVAL '90 min'),
    ('rest0006-0000-0000-0000-000000000010','rest0002-0000-0000-0000-000000000026','rest0003-0000-0000-0000-000000000001',NOW()-INTERVAL '11 days',NOW()-INTERVAL '11 days'+INTERVAL '60 min'),
    ('rest0006-0000-0000-0000-000000000011','rest0002-0000-0000-0000-000000000002','rest0003-0000-0000-0000-000000000003',NOW()-INTERVAL '13 days',NOW()-INTERVAL '13 days'+INTERVAL '2 hours'),
    ('rest0006-0000-0000-0000-000000000012','rest0002-0000-0000-0000-000000000019','rest0003-0000-0000-0000-000000000001',NOW()-INTERVAL '15 days',NOW()-INTERVAL '15 days'+INTERVAL '90 min'),
    ('rest0006-0000-0000-0000-000000000013','rest0002-0000-0000-0000-000000000007','rest0003-0000-0000-0000-000000000003',NOW()-INTERVAL '18 days',NOW()-INTERVAL '18 days'+INTERVAL '2 hours'),
    ('rest0006-0000-0000-0000-000000000014','rest0002-0000-0000-0000-000000000023','rest0003-0000-0000-0000-000000000001',NOW()-INTERVAL '21 days',NOW()-INTERVAL '21 days'+INTERVAL '75 min'),
    ('rest0006-0000-0000-0000-000000000015','rest0002-0000-0000-0000-000000000031','rest0003-0000-0000-0000-000000000003',NOW()-INTERVAL '26 days',NOW()-INTERVAL '26 days'+INTERVAL '90 min')
ON CONFLICT (id) DO NOTHING;

INSERT INTO restauranttunisia.orders (id, table_id, session_id, order_type, status, created_at, updated_at) VALUES
    ('rest0007-0000-0000-0000-000000000005','rest0002-0000-0000-0000-000000000003','rest0006-0000-0000-0000-000000000004','DineIn','Completed',NOW()-INTERVAL '2 days', NOW()-INTERVAL '2 days'),
    ('rest0007-0000-0000-0000-000000000006','rest0002-0000-0000-0000-000000000008','rest0006-0000-0000-0000-000000000005','DineIn','Completed',NOW()-INTERVAL '3 days', NOW()-INTERVAL '3 days'),
    ('rest0007-0000-0000-0000-000000000007','rest0002-0000-0000-0000-000000000017','rest0006-0000-0000-0000-000000000006','DineIn','Completed',NOW()-INTERVAL '5 days', NOW()-INTERVAL '5 days'),
    ('rest0007-0000-0000-0000-000000000008','rest0002-0000-0000-0000-000000000020','rest0006-0000-0000-0000-000000000007','DineIn','Completed',NOW()-INTERVAL '6 days', NOW()-INTERVAL '6 days'),
    ('rest0007-0000-0000-0000-000000000009','rest0002-0000-0000-0000-000000000005','rest0006-0000-0000-0000-000000000008','DineIn','Completed',NOW()-INTERVAL '8 days', NOW()-INTERVAL '8 days'),
    ('rest0007-0000-0000-0000-000000000010','rest0002-0000-0000-0000-000000000012','rest0006-0000-0000-0000-000000000009','DineIn','Completed',NOW()-INTERVAL '9 days', NOW()-INTERVAL '9 days'),
    ('rest0007-0000-0000-0000-000000000011','rest0002-0000-0000-0000-000000000026','rest0006-0000-0000-0000-000000000010','DineIn','Completed',NOW()-INTERVAL '11 days',NOW()-INTERVAL '11 days'),
    ('rest0007-0000-0000-0000-000000000012','rest0002-0000-0000-0000-000000000002','rest0006-0000-0000-0000-000000000011','DineIn','Completed',NOW()-INTERVAL '13 days',NOW()-INTERVAL '13 days'),
    ('rest0007-0000-0000-0000-000000000013','rest0002-0000-0000-0000-000000000019','rest0006-0000-0000-0000-000000000012','DineIn','Completed',NOW()-INTERVAL '15 days',NOW()-INTERVAL '15 days'),
    ('rest0007-0000-0000-0000-000000000014','rest0002-0000-0000-0000-000000000007','rest0006-0000-0000-0000-000000000013','DineIn','Completed',NOW()-INTERVAL '18 days',NOW()-INTERVAL '18 days'),
    ('rest0007-0000-0000-0000-000000000015','rest0002-0000-0000-0000-000000000023','rest0006-0000-0000-0000-000000000014','DineIn','Completed',NOW()-INTERVAL '21 days',NOW()-INTERVAL '21 days'),
    ('rest0007-0000-0000-0000-000000000016','rest0002-0000-0000-0000-000000000031','rest0006-0000-0000-0000-000000000015','DineIn','Completed',NOW()-INTERVAL '26 days',NOW()-INTERVAL '26 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO restauranttunisia.order_items (id, order_id, menu_item_id, menu_item_name, unit_price, quantity) VALUES
    ('rest00oi-0000-0000-0000-000000000010','rest0007-0000-0000-0000-000000000005','rest0005-0000-0000-0000-000000000005','Couscous Agneau', 18.000,1),
    ('rest00oi-0000-0000-0000-000000000011','rest0007-0000-0000-0000-000000000005','rest0005-0000-0000-0000-000000000011','Thé à la Menthe',  2.500,2),
    ('rest00oi-0000-0000-0000-000000000012','rest0007-0000-0000-0000-000000000006','rest0005-0000-0000-0000-000000000006','Tajine Poulet',   15.000,2),
    ('rest00oi-0000-0000-0000-000000000013','rest0007-0000-0000-0000-000000000006','rest0005-0000-0000-0000-000000000012','Café Arabica',     2.000,2),
    ('rest00oi-0000-0000-0000-000000000014','rest0007-0000-0000-0000-000000000007','rest0005-0000-0000-0000-000000000001','Brick à l''œuf',   5.500,2),
    ('rest00oi-0000-0000-0000-000000000015','rest0007-0000-0000-0000-000000000007','rest0005-0000-0000-0000-000000000013','Jus de Grenade',   4.500,2),
    ('rest00oi-0000-0000-0000-000000000016','rest0007-0000-0000-0000-000000000008','rest0005-0000-0000-0000-000000000007','Kafteji',         13.000,2),
    ('rest00oi-0000-0000-0000-000000000017','rest0007-0000-0000-0000-000000000008','rest0005-0000-0000-0000-000000000016','Boisson Fraîche',  3.000,2),
    ('rest00oi-0000-0000-0000-000000000018','rest0007-0000-0000-0000-000000000009','rest0005-0000-0000-0000-000000000008','Ojja Merguez',    14.000,1),
    ('rest00oi-0000-0000-0000-000000000019','rest0007-0000-0000-0000-000000000009','rest0005-0000-0000-0000-000000000017','Makroudh',         4.500,2),
    ('rest00oi-0000-0000-0000-000000000020','rest0007-0000-0000-0000-000000000010','rest0005-0000-0000-0000-000000000009','Poisson du Jour',  22.000,1),
    ('rest00oi-0000-0000-0000-000000000021','rest0007-0000-0000-0000-000000000010','rest0005-0000-0000-0000-000000000018','Baklawa',          5.000,2),
    ('rest00oi-0000-0000-0000-000000000022','rest0007-0000-0000-0000-000000000011','rest0005-0000-0000-0000-000000000005','Couscous Agneau', 18.000,2),
    ('rest00oi-0000-0000-0000-000000000023','rest0007-0000-0000-0000-000000000011','rest0005-0000-0000-0000-000000000012','Café Arabica',     2.000,2),
    ('rest00oi-0000-0000-0000-000000000024','rest0007-0000-0000-0000-000000000012','rest0005-0000-0000-0000-000000000021','Lablabi',          8.000,2),
    ('rest00oi-0000-0000-0000-000000000025','rest0007-0000-0000-0000-000000000012','rest0005-0000-0000-0000-000000000011','Thé à la Menthe',  2.500,2),
    ('rest00oi-0000-0000-0000-000000000026','rest0007-0000-0000-0000-000000000013','rest0005-0000-0000-0000-000000000006','Tajine Poulet',   15.000,1),
    ('rest00oi-0000-0000-0000-000000000027','rest0007-0000-0000-0000-000000000013','rest0005-0000-0000-0000-000000000017','Makroudh',         4.500,2),
    ('rest00oi-0000-0000-0000-000000000028','rest0007-0000-0000-0000-000000000014','rest0005-0000-0000-0000-000000000010','Assiette Merguez',16.000,2),
    ('rest00oi-0000-0000-0000-000000000029','rest0007-0000-0000-0000-000000000014','rest0005-0000-0000-0000-000000000016','Boisson Fraîche',  3.000,3),
    ('rest00oi-0000-0000-0000-000000000030','rest0007-0000-0000-0000-000000000015','rest0005-0000-0000-0000-000000000022','Fricassé',         6.500,4),
    ('rest00oi-0000-0000-0000-000000000031','rest0007-0000-0000-0000-000000000015','rest0005-0000-0000-0000-000000000011','Thé à la Menthe',  2.500,2),
    ('rest00oi-0000-0000-0000-000000000032','rest0007-0000-0000-0000-000000000016','rest0005-0000-0000-0000-000000000003','Chorba Frik',      6.000,3),
    ('rest00oi-0000-0000-0000-000000000033','rest0007-0000-0000-0000-000000000016','rest0005-0000-0000-0000-000000000019','Crème Caramel',    4.000,2)
ON CONFLICT (id) DO NOTHING;
