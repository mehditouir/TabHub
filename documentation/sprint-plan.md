# TabHub — Sprint Plan
### Internship Graduation Project | 2026

---

## Project Timeline Overview

| Sprint | Focus | Duration | Weeks |
|--------|-------|----------|-------|
| Sprint 0 | Foundation & Architecture | 2 weeks | W1–W2 |
| Sprint 1 | Identity & Restaurant Setup | 2 weeks | W3–W4 |
| Sprint 2 | Menu System | 2 weeks | W5–W6 |
| Sprint 3 | Order Engine & Billing | 2 weeks | W7–W8 |
| Sprint 4 | Real-Time Layer (SignalR) | 2 weeks | W9–W10 |
| Sprint 5 | Manager Dashboard (Web) | 2 weeks | W11–W12 |
| Sprint 6 | Customer Ordering Interface | 2 weeks | W13–W14 |
| Sprint 7 | Waiter Application | 2 weeks | W15–W16 |
| Sprint 8 | Kitchen, Cashier & Takeaway | 2 weeks | W17–W18 |
| Sprint 9 | Cloud Deployment & CI/CD | 2 weeks | W19–W20 |
| Sprint 10 | Hardening & Demo Preparation | 2 weeks | W21–W22 |

**Total duration: ~22 weeks (~5.5 months)**

---

## Technology Choices & Justifications

These choices apply globally and are documented here to avoid repetition in each sprint.

### Backend — ASP.NET Core Web API (.NET 8 LTS)
**Why .NET 8 over Node.js / Spring Boot / Django?**
- **.NET 8 is LTS** (Long-Term Support until November 2026): stability guaranteed for the project lifetime.
- **Performance**: .NET 8 ranks among the fastest server-side frameworks (TechEmpower benchmarks), critical for real-time restaurant operations.
- **Type safety**: strongly typed language (C#) reduces runtime bugs, essential for financial data (bills, TVA).
- **Azure-native**: Microsoft Azure is optimised for .NET workloads — direct SDK integration, managed identity, App Service optimisations.
- **Team expertise**: the primary developer has .NET/Azure as their core professional stack.
- **SignalR**: ASP.NET Core SignalR is a first-class citizen — no additional infrastructure needed for real-time.

### Database — PostgreSQL
**Why PostgreSQL over SQL Server / MySQL / MongoDB?**
- **Schema-per-tenant**: PostgreSQL's native schema support enables clean, zero-risk tenant isolation (no missed `WHERE tenant_id =` clause possible). SQL Server supports this but at higher cost. MySQL does not support schemas the same way.
- **Cost**: PostgreSQL is open-source. SQL Server licensing adds significant cost for a SaaS product.
- **NUMERIC precision**: `NUMERIC(10,3)` guarantees correct TND (Tunisian Dinar millime) calculations with no floating-point drift — critical for billing.
- **JSONB**: natively stores audit log states and notification payloads without schema changes.
- **EF Core support**: Npgsql provider for EF Core is mature, well-maintained, and supports PostgreSQL-specific features.
- **Azure managed offering**: Azure Database for PostgreSQL Flexible Server provides automated backups, high availability, and easy scaling.

### ORM — Entity Framework Core 8
**Why EF Core over Dapper / raw SQL?**
- **Productivity**: strongly typed LINQ queries, automatic migrations, and change tracking significantly speed up development.
- **Multi-tenant schema switching**: EF Core supports dynamic `search_path` via connection-level settings, enabling schema-per-tenant without code duplication.
- **Migrations**: version-controlled schema evolution — critical for a project that evolves across 10 sprints.
- **Dapper** would be used for performance-critical reporting queries where raw SQL is preferred (hybrid approach).

### Web Frontend — React + TypeScript + Vite
**Why React over Angular / Vue / Blazor?**
- **Existing knowledge**: the developer has React experience, minimising onboarding time.
- **Ecosystem**: the largest frontend ecosystem — component libraries, charting (for reports), drag-and-drop (floor plan grid).
- **TypeScript**: type safety across the frontend, consistent with the C# backend mindset.
- **Vite**: significantly faster build times than Webpack (Create React App), important for developer productivity during 10 sprints.
- **Blazor** was considered (C# everywhere) but rejected: the React ecosystem is more mature for complex UIs (floor plan grid, real-time dashboards), and the team has no Blazor experience.

### Mobile & Tablet — Ionic React + Capacitor
**Why Ionic over MAUI / Flutter / React Native?**
- **Code sharing**: Ionic React shares components with the React web frontend — the same UI components, hooks, and API clients are reused across web and tablet apps. Estimated ~40% code reuse.
- **React knowledge reuse**: developers write React — no new language or framework to learn.
- **MAUI** was evaluated: while it leverages C# (team strength), it does not share code with the React frontend, is still maturing, and has a smaller component ecosystem.
- **Flutter** was rejected: requires Dart (no existing knowledge) and shares no code with the web stack.
- **React Native** was rejected: different rendering model from web React (no HTML/CSS), breaking the component sharing advantage.
- **Capacitor**: modern native bridge, replacing Cordova, with excellent Android support and access to device features (kiosk mode, push notifications).

### Real-Time — ASP.NET Core SignalR
**Why SignalR over raw WebSockets / Socket.io / Server-Sent Events?**
- **ASP.NET native**: SignalR is built into ASP.NET Core — no additional infrastructure, no separate process.
- **Automatic transport negotiation**: falls back from WebSocket → Server-Sent Events → Long Polling transparently — handles unstable restaurant WiFi gracefully.
- **Groups**: built-in group management maps perfectly to the notification topology (per-tenant, per-role, per-table, per-staff groups).
- **Competing consumer ACK**: SignalR's broadcast model combined with PostgreSQL row-level locking enables the first-writer-wins acknowledgement pattern with no additional message broker.
- **Socket.io** was rejected: Node.js only, incompatible with the .NET stack.

### Cloud — Microsoft Azure (France Central)
**Why Azure over AWS / GCP?**
- **Team expertise**: the developer is a .NET/Azure tech lead — no learning curve on infrastructure.
- **Region**: France Central (Paris) offers the lowest latency from Tunisia (~40–60ms) among Azure regions, with no Tunisian Azure region available.
- **Native .NET integration**: App Service, Static Web Apps, and Azure SDK for .NET are first-class products.
- **Cost**: Azure has competitive pricing for the services used (App Service, PostgreSQL Flexible Server, Blob Storage, CDN).
- **Key Vault**: Azure Key Vault provides secrets management natively integrated with App Service via Managed Identity — no credentials in code.

### Multi-Tenancy — Schema-per-Tenant
**Why schema-per-tenant over shared schema (row-level tenant_id)?**
- **Data isolation**: a missing `WHERE tenant_id = ?` in a shared schema query leaks one restaurant's data to another — catastrophic for a food business. Schema isolation makes this structurally impossible.
- **Shared schema** was evaluated: it is cheaper and simpler but introduces permanent liability in every query. For a trust-sensitive domain (restaurant data, staff data, orders), the risk is unacceptable.
- **Database-per-tenant** was also evaluated: provides the strongest isolation but is significantly more expensive (one PostgreSQL instance per restaurant). Schema-per-tenant achieves the same logical isolation at a fraction of the cost, with the ability to migrate individual high-traffic tenants to dedicated databases later.

---

## Sprint 0 — Foundation & Architecture
**Duration:** 2 weeks | **Weeks:** 1–2

### Objectives
Establish the technical foundation that all subsequent sprints build upon. No features visible to end users yet, but the architecture is validated and proven to work end-to-end.

### Deliverables
- Monorepo initialised (backend / frontend / mobile / shared / documentation)
- .NET 8 Web API running with Swagger UI
- PostgreSQL running locally (Docker)
- EF Core configured with Npgsql and schema-per-tenant provisioning
- Tenant resolution middleware (subdomain → schema switching)
- Health check endpoint (`GET /health`) proving DB connection per tenant
- `nuget.config` isolating project from corporate feeds
- Documentation structure in place

### Definition of Done
> Encadrant can see: Swagger UI at `localhost:5000` with a working `/health` endpoint. Calling it with different `Host` headers demonstrates that different tenant schemas are resolved correctly.

### Technology Choices Introduced
See global section above for full justifications.

| Choice | Alternative Considered | Decision |
|--------|----------------------|----------|
| .NET 8 LTS | Node.js, Spring Boot | .NET 8 — team expertise + Azure native |
| PostgreSQL | SQL Server, MySQL | PostgreSQL — schema-per-tenant + cost |
| EF Core 8 | Dapper, raw SQL | EF Core — productivity + migrations |
| Schema-per-tenant | Row-level tenant_id | Schema-per-tenant — data isolation |
| Docker (local dev) | Local PostgreSQL install | Docker — reproducible environment |

### Diagrams (sprint0/)
- `01-tech-stack.md` — Technology choices overview
- `02-monorepo-structure.md` — Project folder structure
- `03-tenant-middleware-sequence.md` — Tenant resolution flow

---

## Sprint 1 — Identity & Restaurant Setup
**Duration:** 2 weeks | **Weeks:** 3–4

### Objectives
Implement authentication for all user types and the full restaurant configuration API — the foundation every other feature depends on.

### Deliverables
- Manager registration / login / logout / token refresh
- Staff PIN login
- Role-based authorization on all protected endpoints
- Tenant CRUD (super admin)
- Spaces + grid CRUD
- Tables + QR token generation
- Staff CRUD + PIN management
- Waiter zone assignment
- Restaurant config (TVA, language, opening hours)
- Audit trail on all write operations

### Definition of Done
> Encadrant can see: Swagger UI demonstrating full auth flow (login → JWT → refresh → logout). Manager can create a restaurant with spaces, tables, and staff via API. QR token is generated per table. All actions appear in the audit log.

### Technology Choices Introduced

| Choice | Alternative Considered | Decision |
|--------|----------------------|----------|
| Argon2id (manager passwords) | BCrypt, SHA-256 | Argon2id — winner of Password Hashing Competition, memory-hard |
| BCrypt (staff PINs) | Plain hash | BCrypt — appropriate for short PINs, widely supported |
| JWT (access token, 15 min) | Session cookies | JWT — stateless, scales horizontally |
| httpOnly cookie (refresh token) | localStorage | httpOnly cookie — immune to XSS attacks |
| QR code as UUID token | Sequential ID | UUID — unguessable, safe to expose publicly |

### Diagrams (sprint1/)
- `01-erd-sprint1.md` — ERD: platform + setup schemas
- `02-auth-sequence.md` — Manager + staff auth flows
- `03-restaurant-setup-sequence.md` — Space/table/staff setup flow

---

## Sprint 2 — Menu System
**Duration:** 2 weeks | **Weeks:** 5–6

### Objectives
Build the full menu management system: multilingual menus with flexible scheduling, items with modifiers, ingredient management, and photo upload.

### Deliverables
- Ingredients CRUD + translations (FR/AR/EN)
- Menus CRUD + translations + manual toggle
- Menu schedule rules (TIME_RANGE, DAY_OF_WEEK, DATE_RANGE)
- Menu scheduling engine (AND-logic evaluation)
- Menu categories CRUD + translations
- Menu items CRUD + translations + availability toggle
- Menu item photos (upload → resize → Azure Blob → CDN URL stored)
- Item modifier groups + options + translations
- Ingredient-to-item cascade disable
- `GET /menus/active` endpoint (schedule-filtered, localised, cached 60s)

### Definition of Done
> Encadrant can see: manager creates a multilingual breakfast menu with a TIME_RANGE rule (07:00–12:00). Calling `/menus/active` at 11:00 returns it; at 13:00 it is absent. Items have photos served via CDN URL. Disabling an ingredient disables all related items.

### Technology Choices Introduced

| Choice | Alternative Considered | Decision |
|--------|----------------------|----------|
| Azure Blob Storage | AWS S3, local filesystem | Azure Blob — native Azure, managed, CDN-integrated |
| Azure CDN | No CDN, Cloudflare | Azure CDN — native integration, reduces Blob egress costs |
| In-memory cache (60s TTL) | Redis, no cache | In-memory — sufficient for single instance; Redis added if scale requires |
| WebP thumbnail (400×400) | JPEG, original size | WebP — 30% smaller than JPEG, modern browser support |
| Per-entity translation tables | Global translations table | Per-entity — FK constraints, typed, clean cascade deletes |

### Diagrams (sprint2/)
- `01-erd-sprint2.md` — ERD: menus, items, ingredients, options
- `02-menu-schedule-flowchart.md` — Schedule evaluation decision tree
- `03-image-pipeline.md` — Photo upload → resize → Blob → CDN

---

## Sprint 3 — Order Engine & Billing
**Duration:** 2 weeks | **Weeks:** 7–8

### Objectives
Implement the core business logic: table sessions, the full order lifecycle, PDF bill generation with TVA. The heart of the application.

### Deliverables
- Table session lifecycle (open / close / move / merge)
- Order creation (table + takeaway with daily sequence number)
- Order item status machine (pending → preparing → ready → delivered / rejected / cancelled)
- Waiter/cashier orders bypass validation (straight to in_kitchen)
- Bill generation (PDF with itemised list, TVA breakdown, TND)
- Takeaway daily sequence number generation (YYYYMMDDNNNNN)
- Audit trail on all order operations

### Definition of Done
> Encadrant can see: via Swagger/Postman, simulate a full restaurant session: open table → customer submits order → waiter validates → kitchen marks ready → bill generated as PDF → session closed. Takeaway order gets sequential number. Bill PDF shows correct TVA calculation.

### Technology Choices Introduced

| Choice | Alternative Considered | Decision |
|--------|----------------------|----------|
| QuestPDF / iText (PDF) | SSRS, Puppeteer (headless Chrome) | QuestPDF — .NET native, no browser dependency, fast |
| NUMERIC(10,3) for money | decimal (C#), float | NUMERIC(10,3) — exact TND millime representation, no IEEE 754 drift |
| Snapshot columns on order_items | FK to live price | Snapshots — historical accuracy after menu price changes |
| BIGINT daily sequence (YYYYMMDDNNNNN) | Separate sequence table | Embedded date — self-documenting, no extra table, atomic MAX+1 query |

### Diagrams (sprint3/)
- `01-erd-sprint3.md` — ERD: sessions, orders, bills, notifications, audit
- `02-order-status-machine.md` — Order & item status state machines
- `03-session-lifecycle.md` — Table session open/move/merge/close

---

## Sprint 4 — Real-Time Layer (SignalR)
**Duration:** 2 weeks | **Weeks:** 9–10

### Objectives
Add real-time communication to the system. Notifications flow instantly between customers, waiters, kitchen, and managers. The competing-consumer ACK pattern is implemented.

### Deliverables
- SignalR hub with group topology (per-tenant, per-role, per-table, per-staff)
- Notification persistence + broadcast on all order events
- Competing consumer ACK (first-writer-wins, dismiss to all)
- Zone-based waiter notification routing
- Manager fallback when no waiter assigned to zone
- Client reconnection handling (auto-rejoin groups)
- Real-time order status updates pushed to customer browser

### Definition of Done
> Encadrant can see: open 3 browser tabs (customer / waiter A / waiter B). Customer submits order → both waiters see notification simultaneously. Waiter A taps ACK first → notification disappears from Waiter B's tab. Kitchen marks order ready → waiter tab shows delivery notification. All in real time.

### Technology Choices Introduced

| Choice | Alternative Considered | Decision |
|--------|----------------------|----------|
| ASP.NET Core SignalR | Socket.io, raw WebSockets, SSE | SignalR — ASP.NET native, transport fallback, group management built-in |
| PostgreSQL row-level lock (ACK CAS) | Redis pub/sub, dedicated message broker | PostgreSQL CAS — no extra infrastructure; atomic UPDATE WHERE acknowledged_at IS NULL is sufficient at this scale |
| In-process SignalR | Azure SignalR Service | In-process for MVP; Azure SignalR Service added at scale (horizontal scaling) |

### Diagrams (sprint4/)
- `01-signalr-group-topology.md` — Hub groups and routing
- `02-ack-competing-consumer.md` — First-writer-wins ACK sequence

---

## Sprint 5 — Manager Dashboard (Web)
**Duration:** 2 weeks | **Weeks:** 11–12

### Objectives
Build the full manager web dashboard — the primary management interface. Accessible remotely from any browser.

### Deliverables
- Manager login UI (email + password, JWT stored in memory)
- Live floor plan: all spaces, colour-coded table statuses, real-time updates via SignalR
- Menu management UI (menus, schedules, categories, items, photos, modifiers)
- Ingredient management + disable propagation
- Staff management (create, reset PIN, deactivate)
- Space & grid editor (assign tables to cells, drag-and-drop)
- Waiter zone assignment on grid
- QR code generation + download/print per table
- Restaurant config (TVA, language, opening hours)
- Reports page (revenue per period, best-selling items)
- Multilingual UI (FR / AR / EN, RTL for Arabic)

### Definition of Done
> Encadrant can see: manager logs into the web dashboard, creates a full restaurant (spaces, tables, menus with schedules, staff with zones). Floor plan shows live table statuses. QR codes are generated and downloadable. Reports show revenue data.

### Technology Choices Introduced

| Choice | Alternative Considered | Decision |
|--------|----------------------|----------|
| React Query (TanStack Query) | SWR, Redux Toolkit Query | React Query — best-in-class server state management, automatic caching and background refetch |
| React Router v6 | Next.js routing | React Router — SPA is sufficient; Next.js SSR adds complexity with no benefit (dashboard is auth-gated) |
| i18next | react-intl, FormatJS | i18next — largest ecosystem, best RTL support, namespace splitting |
| CSS logical properties (RTL) | Manual RTL CSS | Logical properties — `margin-inline-start` etc. handle RTL/LTR automatically |

### Diagrams (sprint5/)
- `01-dashboard-component-tree.md` — React component hierarchy
- `02-floor-plan-grid-logic.md` — Grid rendering and zone overlay logic

---

## Sprint 6 — Customer Ordering Interface
**Duration:** 2 weeks | **Weeks:** 13–14

### Objectives
Build the customer-facing ordering interface — the most user-visible part of the app. Accessed via QR code on any smartphone, no install required.

### Deliverables
- QR scan → session resolution (join existing or create new)
- Menu browsing (active menus filtered by schedule, localised)
- Item selection with modifier options + free-text notes
- Shared cart (multi-device on same table session via SignalR)
- Order submission + pending confirmation state
- Real-time order status tracking (per-item view if multiple rounds)
- Call waiter button
- Request bill button
- Unavailable item/menu inline error handling
- Responsive mobile-first UI

### Definition of Done
> Encadrant can see: scan QR code with a real phone → browse menus → add items with options → submit order → see "waiting for confirmation" state → after waiter validates (in another tab), status updates to "being prepared" in real time.

### Technology Choices Introduced

| Choice | Alternative Considered | Decision |
|--------|----------------------|----------|
| PWA (browser, no install) | Native app (iOS/Android) | PWA — zero friction for customers, no App Store, works on any smartphone |
| Anonymous session (UUID in URL) | Customer login/registration | Anonymous — no barrier to ordering; session tied to table, not identity |
| SignalR for cart sync | Polling | SignalR — instant multi-device cart synchronisation, no unnecessary requests |

### Diagrams (sprint6/)
- `01-customer-journey.md` — Full customer journey flowchart
- `02-session-state-machine.md` — Table session states from customer perspective

---

## Sprint 7 — Waiter Application
**Duration:** 2 weeks | **Weeks:** 15–16

### Objectives
Build the Ionic React waiter tablet application — the role with the most complex interactions (notifications, floor plan, table operations, validation).

### Deliverables
- PIN login screen
- Floor plan view (assigned zones only, colour-coded statuses)
- Real-time notification overlay on table squares
- Competing consumer ACK on notification tap
- Order validation screen (review items, confirm or reject)
- Place order directly from tablet (skip validation, to kitchen)
- Move session to another table
- Merge table sessions
- Close session (after bill paid)
- Generate + print PDF bill (open signed URL)
- Notification types: order submitted, waiter called, bill requested, order ready, item rejected

### Definition of Done
> Encadrant can see: on a tablet (or browser simulating tablet), waiter logs in with PIN, sees floor plan with only their assigned zone tables. A customer orders from another browser tab — notification flashes on table square. Waiter validates, moves a table, merges two sessions. Bill printed.

### Technology Choices Introduced

| Choice | Alternative Considered | Decision |
|--------|----------------------|----------|
| Ionic React (shared components) | Separate native Android app | Ionic React — ~40% component reuse from web frontend; single codebase for all staff apps |
| Capacitor (APK packaging) | Cordova, PWA for tablets | Capacitor — modern, actively maintained, better device API access than PWA |
| No idle logout (staff) | Auto-logout after inactivity | Dedicated tablets are always-on; idle logout would disrupt mid-service operations |

### Diagrams (sprint7/)
- `01-waiter-notification-routing.md` — Zone-based notification routing logic
- `02-waiter-app-flow.md` — Waiter interaction flowchart

---

## Sprint 8 — Kitchen, Cashier & Takeaway
**Duration:** 2 weeks | **Weeks:** 17–18

### Objectives
Complete all remaining tablet applications and the takeaway display screen. After this sprint, the full restaurant simulation is possible with all roles active simultaneously.

### Deliverables
**Kitchen App:**
- Always-on display (no auth)
- Validated order queue (left panel, per order with status)
- Per-item tick (pending → preparing → ready)
- Collapse/hide completed items
- Item-level notes (customer instructions) displayed
- Item rejection with reason
- Real-time updates via SignalR

**Cashier App:**
- PIN login
- Create walk-in table order (assigned to table)
- Create takeaway order (generates daily sequence number)
- Generate + print PDF bill

**Takeaway Display Screen:**
- Public screen, no auth
- Live order list: order number + status (Submitted / Preparing / Ready)
- Auto-dismiss on collected
- SignalR-driven updates

### Definition of Done
> Encadrant can see: full end-to-end simulation with all 5 roles active: customer orders → waiter validates → kitchen prepares (ticking items) → waiter delivers. Cashier creates takeaway order → appears on TV display → kitchen marks ready → display updates → cashier marks collected → disappears from display.

### Diagrams (sprint8/)
- `01-kitchen-state-machine.md` — Kitchen order/item state transitions
- `02-full-system-simulation.md` — All roles interacting simultaneously

---

## Sprint 9 — Cloud Deployment & CI/CD
**Duration:** 2 weeks | **Weeks:** 19–20

### Objectives
Deploy the entire platform to Microsoft Azure. Set up automated CI/CD pipelines. Configure production environments with proper secrets management.

### Deliverables
- Azure App Service (API, production + staging slots)
- Azure Database for PostgreSQL Flexible Server (production)
- Azure Blob Storage + CDN (photos + PDF bills)
- Azure Key Vault (all secrets via Managed Identity)
- Azure Static Web Apps (React frontend)
- GitHub Actions pipelines:
  - Backend: build → test → deploy to staging → promote to production
  - Frontend: build → deploy to Static Web Apps
- Custom subdomain routing (`{tenant}.tabhub.tn`)
- SSL certificates (auto-managed by Azure)
- Environment separation: Development / Staging / Production
- Application Insights (logging + monitoring)

### Definition of Done
> Encadrant can see: the live app at `demo.tabhub.tn`. A push to the `main` branch on GitHub triggers automatic deployment. Application Insights shows live request telemetry.

### Technology Choices Introduced

| Choice | Alternative Considered | Decision |
|--------|----------------------|----------|
| Azure App Service | Azure Container Apps, AKS | App Service — simplest managed hosting for a single-tenant API; no orchestration overhead |
| GitHub Actions | Azure DevOps, Jenkins | GitHub Actions — native GitHub integration, free for public repos, YAML-based |
| Azure Managed Identity | Connection strings with passwords | Managed Identity — no credentials stored anywhere; App Service authenticates to Key Vault automatically |
| App Service deployment slots | Blue/green on separate instances | Slots — built-in staging → production swap with zero downtime |
| Azure Application Insights | Serilog to file, Datadog | Application Insights — native Azure, no extra cost on basic tier, integrates with App Service |

### Diagrams (sprint9/)
- `01-azure-infrastructure.md` — Detailed Azure resource topology
- `02-cicd-pipeline.md` — GitHub Actions workflow

---

## Sprint 10 — Hardening & Demo Preparation
**Duration:** 2 weeks | **Weeks:** 21–22

### Objectives
Final quality pass: security hardening, performance validation, end-to-end testing, onboarding flow, and preparation of the graduation report and final demo.

### Deliverables
- End-to-end test suite (full order lifecycle)
- Security audit: CORS, rate limiting, input validation (FluentValidation), SQL injection prevention review
- Performance test: SignalR under concurrent load (simulated 50 devices)
- RTL/Arabic layout QA on all screens
- Onboarding wizard for new restaurants (initial setup flow)
- Error handling: global exception middleware, user-friendly error messages
- Final demo environment setup (demo restaurant with realistic data)
- Graduation report writing support (architecture, sprint retrospectives, tech justifications)

### Definition of Done
> Encadrant can see: a live demo at `demo.tabhub.tn` with a realistic Tunisian restaurant. All roles work simultaneously. Arabic UI renders correctly RTL. The graduation report is ready for submission.

### Diagrams (sprint10/)
- `01-security-layers.md` — Security controls at each layer
- `02-test-strategy.md` — Testing pyramid and coverage areas

---

## Cross-Sprint Concerns

### Audit Trail
Every write operation across all sprints logs to `audit_logs` with actor, before/after state, and timestamp. Implemented in Sprint 1 and applied to all new entities in subsequent sprints.

### Translations
Every user-facing entity has translation tables (FR/AR/EN). Implemented from Sprint 2 onwards. Translation middleware resolves the language from the `Accept-Language` header or tenant config.

### Error Handling
A global exception middleware returns structured `ProblemDetails` responses (RFC 7807) on all errors. Input validation uses FluentValidation on all command objects.

### Definition of Done (Global)
Every sprint must satisfy:
- [ ] All new API endpoints documented in Swagger
- [ ] All new entities have EF Core migrations applied
- [ ] All write operations appended to audit trail
- [ ] Code reviewed and merged to `main` via pull request
- [ ] Demonstrable to encadrant in a live session
