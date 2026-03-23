# TabHub — Graduation Project Report
**Final Year Project · 2024–2025**

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Proposed Solution — TabHub](#2-proposed-solution--tabhub)
3. [Technical Architecture](#3-technical-architecture)
4. [Key Technical Decisions](#4-key-technical-decisions)
5. [Development Plan — 10 Sprints](#5-development-plan--10-sprints)
6. [Application Surfaces](#6-application-surfaces)
7. [Security and Robustness](#7-security-and-robustness)
8. [Cloud Deployment](#8-cloud-deployment)
9. [Automated Testing](#9-automated-testing)
10. [Results and Metrics](#10-results-and-metrics)
11. [Future Work and Commercialisation](#11-future-work-and-commercialisation)
12. [Conclusion](#12-conclusion)

---

## 1. Problem Statement

### The Reality of Restaurants in Tunisia (and the MENA Region)

Restaurant management today still relies heavily on manual processes that generate significant hidden costs:

| Problem | Concrete Impact |
|---------|----------------|
| Hand-written orders | Frequent errors, poor kitchen/floor communication |
| Waiting for a waiter | Customer frustration, slower table turnover |
| Paper-based menu management | Printed menu becomes outdated the moment a dish runs out |
| No real-time visibility | Manager discovers problems after the fact |
| Manual billing | Slow, calculation errors, approximate VAT |
| No analytics | No tracking of popular dishes, revenue, or peak hours |

Existing solutions (Lightspeed, Square, Zelty) are designed for Western markets:
- Prohibitive pricing for the average Tunisian restaurant (€50–200/month)
- English-only interface
- No Arabic support (RTL)
- Monolithic architecture not suited for multi-venue management

### The Opportunity

The Tunisian market has approximately **12,000 active restaurants and cafés** (INS 2023). Fewer than 3% use management software. The room for growth is substantial.

---

## 2. Proposed Solution — TabHub

TabHub is a **real-time, multi-tenant restaurant management system**, accessible from any connected device with no installation required.

### Value Proposition

```
Customer scans the QR code on the table
        ↓
Order placed directly from their phone
        ↓
Instant notification to the waiter
        ↓
Ticket sent to the kitchen in real time
        ↓
Cashier closes the session, prints PDF bill
        ↓
Manager sees everything from the dashboard
```

**What TabHub delivers:**
- **Zero order errors** — the customer enters their own order; the kitchen receives exactly what was requested
- **+20% table turnover** — no more waiting to flag down a waiter
- **Live menu** — disable a sold-out dish in 2 seconds from any phone
- **Real data** — revenue, popular dishes, peak hours, average service time
- **Multi-venue** — one account to manage multiple restaurants
- **Trilingual FR/AR/EN** — built for the Tunisian market with native RTL support

---

## 3. Technical Architecture

### Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| Backend API | ASP.NET Core 8 (C#) | Performance, rich ecosystem, excellent WebSocket support |
| Database | PostgreSQL 15 | ACID, multiple schemas, JSONB, native UUIDs |
| Real-time | SignalR (ASP.NET Core) | WebSocket with automatic fallback, integrated with backend |
| Frontend | React 19 + Vite + TypeScript | Reusable components, ultra-fast build |
| Styling | Tailwind CSS 3 | Utility-first, responsive, RTL support via logical properties |
| ORM | Entity Framework Core 8 | Migrations, typed LINQ queries, transactions |
| Auth | JWT (Bearer) + Argon2id / BCrypt | Short-lived tokens (15 min) + Argon2id for manager passwords, BCrypt PIN for staff |
| PDF | QuestPDF | In-process generation, no external dependency |
| CI/CD | GitHub Actions | Automated build, test, deploy |
| Cloud | Azure (Free Tier B1) | App Service + Static Web App + PostgreSQL Flexible Server |

### Multi-Tenant Architecture: Schema-per-Tenant

```
PostgreSQL
├── public
│   ├── tenants          ← restaurant registry
│   ├── managers         ← owner accounts
│   └── manager_tenants  ← manager ↔ restaurant association
├── cafetunisia          ← isolated tenant 1 schema
│   ├── spaces, tables
│   ├── staff, waiter_zones
│   ├── categories, menu_items, modifier_groups
│   ├── menus, menu_schedule_rules
│   ├── table_sessions, orders, order_items
│   └── notifications, audit_logs
└── restauranttunisia    ← isolated tenant 2 schema
    └── (same structure)
```

**Benefits of this approach:**
- Complete data isolation (impossible to see another restaurant's data)
- No `tenant_id` column on every table — simpler queries
- Per-tenant backup is trivial (`pg_dump -n cafetunisia`)
- SchemaProvisioner migration: new restaurant → new schema created automatically

### Real-Time Data Flow (SignalR)

```
[Client Browser]                [Backend SignalR Hub]
     │                                   │
     │──── WS connect (tenant group) ────▶│
     │                                   │
[Customer places order]                  │
     │──── POST /orders ─────────────────▶│
                                         │── broadcast → "tenant:cafetunisia"
                                         │     ├── Waiter app: notification badge
                                         │     ├── Kitchen app: new card in kanban
                                         │     └── Cashier app: session updated
```

---

## 4. Key Technical Decisions

### 4.1 Schema-per-Tenant vs. Row-per-Tenant

| Approach | Advantages | Disadvantages |
|----------|------------|---------------|
| **Schema-per-tenant** ✅ | Complete isolation, no filter to forget, simple backup | DDL must be duplicated, ~500 schema count limit |
| Row-per-tenant | Single schema | Risk of data leakage, more complex queries |
| DB-per-tenant | Maximum isolation | Prohibitive operational cost |

For a B2B restaurant SaaS, schema-per-tenant is the right trade-off.

### 4.2 SignalR vs. Polling

Polling (every X seconds) would have been simpler to implement but causes:
- 2–10 second latency (poor UX for the kitchen)
- Constant server load even during inactivity
- Drained mobile battery

SignalR (WebSocket) delivers:
- Updates in < 100 ms
- Zero requests when nothing changes
- A single channel for all events (orders, status changes, notifications)

### 4.3 Two-Level Authentication

```
Manager (owner)      → JWT Bearer + httpOnly refresh cookie  (password: Argon2id)
Staff (waiter/cook)  → BCrypt PIN (4–8 digits)
```

Staff members have no email or password. They use a simple PIN on a shared tablet. This UX decision is critical: a waiter should not lose time typing a complex password between every table.

### 4.4 Multi-Surface React SPA

A single React application serves 7 distinct surfaces:

```
/menu/:tenant        → customer interface (phone)
/waiter/:tenant      → waiter app (tablet)
/kitchen/:tenant     → kitchen kanban (wall screen)
/cashier/:tenant     → cashier kiosk (tablet)
/takeaway/:tenant    → takeaway display screen
/manager/:tenant/*   → owner dashboard
/admin               → super admin panel
```

**Advantage:** a single build, a single deployment, shared code (components, API client, translations).

---

## 5. Development Plan — 10 Sprints

| Sprint | Duration | Goal | Main Deliverable |
|--------|----------|------|-----------------|
| 0 | 1 week | Architecture & foundations | API /health, Docker, CI |
| 1 | 1 week | Identity & configuration | JWT auth, restaurant config, tenant provisioning |
| 2 | 1 week | Menu system | Categories, items, modifiers, ingredients |
| 3 | 1 week | Order engine | Sessions, orders, PDF billing |
| 4 | 1 week | Real-time SignalR | WebSocket hub, live notifications |
| 5 | 1 week | Manager dashboard | KPIs, revenue charts, top items |
| 6 | 1 week | Customer QR interface | Customer menu, cart, order placement |
| 7 | 1 week | Waiter application | Waiter app, zones, ACK notifications |
| 8 | 1 week | Kitchen, cashier, takeaway | Kitchen kanban, cashier kiosk, takeaway board |
| 9 | 1 week | Cloud deployment | Azure, GitHub Actions CI/CD, HTTPS |
| 10 | 1 week | Hardening & demo prep | Security, RTL, E2E tests, demo data |

**Total duration: ~10 weeks** of effective development.

---

## 6. Application Surfaces

### 6.1 Customer Interface (QR Menu)
- Accessible via QR code on each table (`/menu/:tenant?table=<uuid>`)
- Displays the active menu in real time (per scheduling rules)
- Add to cart with modifiers (sugar level, cooking preference, extras)
- Order placement with no account, no installation required
- FR / AR (native RTL) / EN support

### 6.2 Waiter Application
- PIN login in 2 seconds on a shared tablet
- Interactive floor plan — tables colour-coded by status
- Real-time notification badge for incoming orders
- Order acknowledgement and status advancement
- Zone management (waiter X covers tables Y to Z)

### 6.3 Kitchen Kanban
- Kanban view: Pending → InProgress → Ready
- Per-order timer (identifies delays)
- SignalR connection indicator (green/red dot)
- Role-based filtering (Chef Amine and Sana see only their section)

### 6.4 Cashier App
- Takeaway order entry (with displayed sequence number)
- Table session closing
- PDF bill generation (QuestPDF, VAT included)
- Session history for the day

### 6.5 Takeaway Display
- Large-format screen, no authentication required
- Shows in-progress and ready takeaway orders
- Live updates via SignalR

### 6.6 Manager Dashboard
- Real-time KPIs: total orders, pending, in progress, ready, completed, cancelled
- 30-day revenue chart (bar per day)
- Top 5 items (quantity + revenue)
- Average order completion time

### 6.7 Super Admin Panel
- Tenant (restaurant) creation and management
- Manager account creation and management
- Assigning a manager to multiple restaurants

---

## 7. Security and Robustness

### Security Measures Implemented

| Measure | Detail |
|---------|--------|
| Short-lived JWTs (15 min) | Refresh via httpOnly cookie (30 days) |
| Argon2id (managers) | Memory-hard password hashing — winner of the Password Hashing Competition |
| BCrypt work factor 10 (staff) | PIN hashing — appropriate for short numeric codes |
| Rate limiting | 10 req/min per IP on auth endpoints |
| FluentValidation | Strict input validation (email format, PIN 4–8 digits, slug regex) |
| Tenant isolation | `search_path` per request — impossible to access another tenant's data |
| Soft delete | `deleted_at` — no data is physically deleted |
| Audit log | All mutations logged (actor, before/after state) |
| ExceptionMiddleware | Uniform JSON `{ "error": "..." }` on every unhandled exception |
| CORS configured | Explicitly whitelisted origins in production |

### Robustness
- Testcontainers for backend integration tests (real PostgreSQL instance)
- MSW (Mock Service Worker) for frontend tests
- 83 Playwright E2E tests running against production
- GitHub Actions CI/CD: build + test + deploy on every push to master

---

## 8. Cloud Deployment

### Azure Architecture (12-Month Free Tier)

```
Internet
   │
   ├── Azure Static Web App (Free)
   │   └── React SPA (frontend/)
   │
   ├── Azure App Service B1 (Free 12 months)
   │   └── ASP.NET Core 8 API
   │       ├── /api/*
   │       ├── /hubs/orders (SignalR WebSocket)
   │       └── /wwwroot/uploads (images)
   │
   └── Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
       └── tabhub DB (2 tenants, ~50 MB)
```

**Production URLs:**
- Frontend: `https://ashy-grass-0c75bb903.6.azurestaticapps.net`
- API: `https://tabhub-api-caguf5bkb7b9bzca.francecentral-01.azurewebsites.net`

**Estimated monthly cost:** ~€0 during the 12-month Azure free trial.

### CI/CD — GitHub Actions

```yaml
# backend.yml
push master → dotnet build → dotnet test → deploy App Service

# frontend.yml
push master → npm install → npm run build → deploy Static Web App
```

---

## 9. Automated Testing

### Backend — xUnit + Testcontainers

- Integration tests against a real PostgreSQL database (Testcontainers)
- Coverage: Auth, Config, Spaces, Staff, Menu, Orders, Sessions, Reports, Admin
- Run: `dotnet test` (CI: `backend.yml`)

### Frontend — Vitest + MSW

- Unit and integration tests for React components
- MSW intercepts API calls (no backend required)
- Coverage: Login, Menu, Spaces, Staff, CustomerMenu, WaiterApp, KitchenApp
- Run: `npm test` (CI: `frontend.yml`)

### E2E — Playwright TypeScript

83 automated tests covering the full functional regression suite:

| Module | Tests | Surface |
|--------|-------|---------|
| Auth & login | T-01–T-06 | Manager login, guard, logout |
| Configuration | T-07–T-09 | Name, VAT, opening hours |
| Spaces & tables | T-10–T-13 | Create, QR, delete |
| Staff | T-14–T-18 | CRUD staff, zones |
| Menu | T-19–T-24 | Categories, items, modifiers, ingredients |
| PIN login | T-25–T-28 | Waiter, kitchen, cashier |
| Customer order | T-29–T-37 | Cart, placement, SignalR |
| Waiter app | T-38–T-45 | Notifications, ACK, advancement |
| Kitchen | T-46–T-49 | Kanban, timer, SignalR |
| Cashier | T-50–T-52 | Sessions, takeaway orders |
| Takeaway | T-53–T-54 | Live display |
| E2E simulation | T-55–T-56 | 5 simultaneous contexts |
| Dashboard | T-57–T-59 | KPIs, revenue, QR |
| Tenant isolation | T-60–T-61 | Cross-tenant rejection |
| Navigation | T-62–T-64 | Routes, deep links |
| PDF | T-65 | Bill generation |
| Images | T-66–T-67 | Upload, large image |
| Scheduling | T-68–T-69 | Active/inactive menu scheduling |
| Multilingual | T-70–T-71 | FR/AR/EN, RTL |
| Edge cases | T-72–T-75 | Empty cart, unavailable item, invalid QR, 404 |
| Super admin | T-76–T-83 | Login, tenants, managers |

**Key characteristics:**
- Sequential execution (workers: 1) — production is a shared persistent database
- Idempotent — tests create their own data (prefixed `E2E`) using find-or-create
- Visual traces on failure (Playwright traces)
- Multi-context for SignalR tests (5 simultaneous browser windows)

---

## 10. Results and Metrics

### Delivered Features

- ✅ 7 distinct application surfaces
- ✅ Multi-tenant with complete data isolation
- ✅ End-to-end real-time SignalR (< 200 ms latency)
- ✅ Trilingual FR / AR (RTL) / EN
- ✅ PDF bill generation (VAT, items, totals)
- ✅ Menu scheduling (TIME_RANGE, DAY_OF_WEEK)
- ✅ Image upload with WebP conversion
- ✅ Full audit log
- ✅ Operational cloud deployment (HTTPS, CI/CD)
- ✅ 83 automated E2E tests

### Codebase Volume

| Layer | Files | Lines (approx.) |
|-------|-------|----------------|
| Backend C# | ~50 files | ~5,000 lines |
| Frontend TypeScript/TSX | ~80 files | ~8,000 lines |
| Backend tests | ~15 files | ~2,000 lines |
| E2E tests | ~25 files | ~3,000 lines |
| SQL / Config | ~10 files | ~800 lines |

---

## 11. Future Work and Commercialisation

### Immediate Technical Roadmap

| Feature | Priority | Complexity |
|---------|----------|------------|
| Native mobile app (React Native) | High | High |
| Azure SignalR Service (scale-out) | High | Medium |
| Online payment (Flouci / Stripe) | High | High |
| Customer loyalty system | Medium | Medium |
| Thermal printer integration | Medium | Medium |
| Advanced reports (Excel/PDF export) | Medium | Low |
| Inventory and supply management | High | High |
| Online reservations | Low | Medium |

### Business Model

**Initial target:** Urban Tunisian cafés and restaurants (Tunis, Sousse, Sfax)

| Plan | Price/month | Includes |
|------|-------------|---------|
| Starter | 49 TND | 1 space, 20 tables, 3 staff |
| Pro | 99 TND | 5 spaces, unlimited tables/staff, analytics |
| Enterprise | Custom | Multi-venue, dedicated support |

**Competitive advantages:**
1. **Price** — 5–10× cheaper than Western solutions
2. **Language** — native Arabic (RTL), French, English
3. **Simplicity** — 5-minute onboarding, no training required
4. **Local** — Tunisian customer support, Tunisian tax compliance (VAT 7%/19%)

### Launch Strategy

1. **Pilot phase (months 1–3)** — 5 test restaurants in Tunis (free in exchange for feedback)
2. **Public launch (month 4)** — landing page, pricing, 30-day free trial
3. **Scale (months 6–12)** — partnerships with restaurant equipment suppliers

---

## 12. Conclusion

TabHub demonstrates that it is possible to build a **professional, multi-tenant, real-time SaaS system** in under 3 months using a modern stack and solid engineering practices.

The architectural choices (schema-per-tenant, SignalR, multi-surface SPA) are justified by real constraints of the restaurant domain:
- Data isolation between establishments
- Real-time responsiveness for kitchen/floor coordination
- A single interface serving 7 different user profiles

The test coverage (83 E2E + backend and frontend unit tests) provides a solid foundation for evolving the product.

TabHub is **live in production** on Azure, accessible from any phone via a simple QR code. It forms a commercially viable base for addressing the Tunisian restaurant market and, in time, the broader MENA region.

---

*Report written as part of the final year graduation project — 2024–2025*
