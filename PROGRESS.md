# TabHub — Progress Tracker

> Keep this file in sync with development. Update on every feature addition, completion, or scope change.

---

## Sprint Status Overview

| Sprint | Focus | Status |
|--------|-------|--------|
| 0 | Foundation & Architecture | ✅ Complete |
| 1 | Identity & Restaurant Setup | ✅ Complete |
| 2 | Menu System | ✅ Complete |
| 3 | Order Engine & Billing | ✅ Complete |
| 4 | Real-Time Layer (SignalR) | ✅ Complete |
| 5 | Manager Dashboard (Web) | ✅ Complete |
| 6 | Customer Ordering Interface | ✅ Complete |
| 7 | Waiter Application | ✅ Complete |
| 8 | Kitchen, Cashier & Takeaway | ❌ Not started |
| 9 | Cloud Deployment & CI/CD | ❌ Not started |
| 10 | Hardening & Demo Preparation | ❌ Not started |

---

## Sprint 0 — Foundation & Architecture ✅ COMPLETE

- .NET 8 Web API running with Swagger UI
- PostgreSQL in Docker (postgres:15-alpine, port 5432)
- EF Core + Npgsql, snake_case naming, schema-per-tenant provisioning
- TenantMiddleware: resolves `X-Tenant` header or query param → sets `search_path`
- `GET /health` endpoint proving DB connection per tenant
- `nuget.config`, `global.json`, `docker-compose.yml` in place
- Documentation structure (`documentation/` with sprint diagrams)

---

## Sprint 1 — Identity & Restaurant Setup ✅ COMPLETE

**Backend APIs:**
- Manager auth: login (Argon2id), JWT (15 min), httpOnly refresh cookie (30 days), logout
- Staff PIN login: BCrypt, staff JWT (12 hr)
- Role-based authorization on all protected endpoints
- Spaces CRUD + grid (cols × rows)
- Tables CRUD + QR token (UUID) generation
- Staff CRUD + PIN management
- Waiter zone assignment (col/row range per space)
- Config CRUD (TVA, language, opening hours)
- Audit trail on all write operations

**Tests:** Auth, AuthAdvanced, Spaces, SpaceIntegrity, Tables, TableIntegrity, Staff, StaffIntegrity, Config, TenantIsolation, WaiterZones — all passing.

---

## Sprint 2 — Menu System ✅ COMPLETE

**Done:**
- Categories CRUD (name, sortOrder, isActive, soft delete)
- Category translations table (structure in DB; translation endpoints not yet exposed)
- Menu items CRUD (name, description, price, imageUrl, isAvailable, sortOrder, categoryId)
- Menu item translations table (structure in DB)
- `GET /public-menu` — returns all active categories + items for customer QR menu
- Tests: Categories, CategoryIntegrity, MenuItems, MenuItemIntegrity, PublicMenu, MenuTenantIsolation — all passing

**Also done (Sprint 2 complete):**
- ✅ Ingredients CRUD + translations (`GET/POST/PUT/DELETE /ingredients`, `PUT /ingredients/{id}/translations/{lang}`)
- ✅ Cascade-disable: disabling an ingredient sets `isAvailable=false` on all linked menu items
- ✅ Ingredient ↔ menu item links (`POST/DELETE /ingredients/{id}/menu-items/{menuItemId}`)
- ✅ Menus CRUD + translations (`GET/POST/PUT/DELETE /menus`, `PUT /menus/{id}/translations/{lang}`)
- ✅ Schedule rules: TIME_RANGE (HH:mm), DAY_OF_WEEK (bitmask Mon=1…Sun=64), DATE_RANGE (yyyy-MM-dd)
- ✅ `GET /menus/active` — AND-logic scheduling engine, public/anonymous, returns menus with categories + items + modifiers
- ✅ Menu → category assignments (`POST/DELETE /menus/{id}/categories/{categoryId}`)
- ✅ Modifier groups CRUD + translations (`/modifier-groups`)
- ✅ Modifier options CRUD + translations (`/modifier-options`)
- ✅ `GET /menu` (public) updated to include modifier groups + options on every item
- ✅ `POST /menu-items/{id}/image` — multipart upload, resizes to WebP 400×400; uses Azure Blob if configured, local `wwwroot/uploads/` otherwise
- ✅ `SixLabors.ImageSharp` + `Azure.Storage.Blobs` packages added
- ✅ All new tables applied to live DB (cafetunisia + restauranttunisia schemas)

---

## Sprint 3 — Order Engine & Billing ✅ COMPLETE

**Done:**
- Orders CRUD (tableId, status, notes)
- OrderItems (menuItemName + unitPrice snapshots, quantity, notes)
- Order status machine: Pending → Preparing → Ready → Delivered / Cancelled
- `PUT /orders/{id}/status` — advance or cancel
- Tests: Orders, OrderIntegrity, OrderTenantIsolation — all passing

**Also done:**
- ✅ Table sessions CRUD (open/close/move/merge) — `TableSession` entity, `SessionsController`, `GET/POST /sessions`, `PUT /sessions/{id}/close|move|merge`
- ✅ Waiter/cashier bypass path — `POST /orders/staff` starts orders directly at InProgress (skips Pending)
- ✅ Takeaway orders — `POST /orders/takeaway` (staff auth, no table, daily sequence YYYYMMDDNNNNN)
- ✅ PDF bill generation — `GET /orders/{id}/bill.pdf` (QuestPDF, TVA breakdown, TND, A5)
- ✅ Audit trail on all order operations (create, create_takeaway, status_update, cancel) and all session operations (open, close, move, merge)
- ✅ `order_type` and `sequence_number` columns on orders; `table_id` now nullable for takeaway
- ✅ `table_sessions` table added to SchemaProvisioner + db-init.sql + live DB (both schemas)

---

## Sprint 4 — Real-Time Layer (SignalR) ✅ COMPLETE

**Done:**
- `OrderHub` at `/hubs/orders`
- Per-tenant groups (`tenant_{schemaName}`)
- Events: `OrderPlaced`, `OrderStatusChanged`, `OrderCancelled` — broadcast on order mutations
- Frontend `useOrderHub.ts` hook — connects, joins group, handles all 3 events
- Tests: OrderHubTests — passing

**Also done:**
- ✅ Notification persistence — `notifications` table; created on every `OrderPlaced` event
- ✅ Competing consumer ACK — `PUT /notifications/{id}/ack` with `SELECT … FOR UPDATE` row lock; first caller wins, others get 409
- ✅ Zone-based waiter routing — `OrderPlaced` sends `NewOrderNotification` to `staff_{staffId}` groups for all waiters whose zones cover the order's table col/row
- ✅ Manager fallback — if no waiter zone covers the table (or it's a takeaway), notification goes to `manager_{schema}` group
- ✅ Per-table and per-staff SignalR groups — `OrderHub` joins `staff_{staffId}` / `manager_{schema}` / `table_{tableId}` on connect based on JWT claims + `?tableId` query param
- ✅ Client reconnection auto-rejoin — `withAutomaticReconnect()` triggers server-side `OnConnectedAsync` on reconnect; groups restored automatically
- ✅ `GET /notifications` + `GET /notifications/{id}` — list/get with order details included
- ✅ `JoinTableGroup(tableId)` hub method — customer-facing pages can opt into per-table feed at runtime
- ✅ Frontend: `useOrderHub` handles `NewOrderNotification` event; `Order` type updated (nullable tableId, orderType, sequenceNumber); `Notification` type added

---

## Sprint 5 — Manager Dashboard (Web) ✅ COMPLETE

**Done:**
- Login page (email + password, role-based redirect, JWT in localStorage)
- Manager layout: sidebar nav (Dashboard / Menu / Spaces / Staff / Settings) + language switcher (FR/AR/EN)
- Dashboard: KPI cards (orders, revenue, avg order, top item) + revenue bar chart + top items list
- Menu page: category accordion + category CRUD modal + item CRUD modal (name, price, desc, sortOrder, isAvailable) + photo upload
- Spaces page: 3 tabs — Editor (cols×rows grid + QR modals), Live (real-time table status colours, polls every 30s), Zones (waiter zone drag-assign + zone list)
- Staff page: staff list with role badges + add/edit/delete modal + PIN management
- Config page: restaurant name, TVA rate, default language, per-day opening hours (all persisted via PUT /config/{key})
- Waiter zone API client (getWaiterZones, createWaiterZone, deleteWaiterZone)
- Reports API client (`getRevenue`, `getTopItems`, `getOrderSummary`, `getBusiestHours`)
- ReportsController + ReportsTests — passing
- Multilingual UI: i18next + react-i18next, FR/AR/EN locale files, RTL for Arabic (document.dir), language persisted in localStorage
- Frontend tests: Login, Dashboard (99 tests total, all passing)

**Not done (deferred to later sprints):**
- [ ] Tests for Spaces, Menu, Staff, Config pages

---

## Sprint 6 — Customer Ordering Interface ✅ COMPLETE

**Done:**
- `CustomerMenu.tsx`: scan QR → fetch public menu → browse categories/items → cart → place order
- ✅ Table session resolution — `OrdersController.Create` auto-links order to active session on the table
- ✅ Item modifier selection UI — modal with radio/checkbox per group; validates required groups; adjusts price via priceDelta; encodes selections as order item notes
- ✅ Real-time order status tracking — post-submit view with step indicator (Pending→InProgress→Ready→Served); SignalR connection to tenant group filters by orderId
- ✅ Call waiter button — `POST /orders/call-waiter`; broadcasts `WaiterCalled` to zone-covering staff or manager fallback
- ✅ Request bill button — `POST /orders/request-bill`; broadcasts `BillRequested` to zone-covering staff or manager fallback
- ✅ Unavailable item inline error handling — items show "Unavailable" badge, Add button hidden, card grayed out
- ✅ Mobile-first responsive polish — item images, floating cart with proper safe-area, modal slides up from bottom on mobile
- ✅ TenantMiddleware: also reads `X-Tenant` from query string (fixes SignalR multi-tenancy for anonymous customers)

- ✅ Shared cart across multiple devices — `BroadcastCart` hub method sends `CartUpdated` via `OthersInGroup`; `GET /tables/resolve` resolves qrToken → tableId; client joins `table_{tableId}` group on mount; remote updates use `isRemoteUpdate` ref to prevent echo loops; toast shown on sync
- ✅ Multilingual i18n — `customer` key section added to FR/AR/EN locale files; `CustomerMenu` uses `useTranslation` throughout

---

## Sprint 7 — Waiter Application ✅ COMPLETE

Ionic React tablet app in `mobile/`. All planned features shipped.

- ✅ Staff PIN login — tenant slug + PIN keypad; JWT stored in localStorage; role-based (`waiter`)
- ✅ Floor plan (assigned zones only) — space selector with IonSegment; grid highlights tables in waiter's zones; colour-coded by status: free (green) / occupied (orange) / attention (red = pending/inProgress orders)
- ✅ Notification overlay — `NotificationBanner` fixed at top; handles `NewOrderNotification`, `WaiterCalled`, `BillRequested` SignalR events
- ✅ Competing consumer ACK on tap — `PUT /notifications/{id}/ack`; 409 → "already taken" message; auto-dismiss after 1.5s
- ✅ Order queue tab — live list via SignalR (`useWaiterHub`); status filter tabs; advance/cancel per order
- ✅ Place order from tablet — `POST /orders/staff` (starts InProgress); browses public menu; floating cart; posts with tableId + optional sessionId
- ✅ Move/merge sessions — Sessions tab lists open sessions; Move modal picks a free table; Merge modal picks another session; calls PUT /sessions/{id}/move and PUT /sessions/{id}/merge
- ✅ Close session + PDF bill — close button triggers `PUT /sessions/{id}/close`; fetches latest order; renders PDF in iframe via blob URL
- ✅ SignalR hub (`useWaiterHub`) — connects as staff JWT; joins `staff_{staffId}` group server-side; handles all 6 event types; auto-reconnect
- ✅ `WaiterContext` — global context with auth + hub state shared across all tabs and the notification overlay
- ✅ Dev server on port 5174 (separate from frontend on 5173)

---

## Sprint 8 — Kitchen, Cashier & Takeaway ❌ NOT STARTED

Depends on Sprint 7 completion.

Planned:
- **Kitchen app:** always-on display, item tick (pending → preparing → ready), item rejection
- **Cashier app:** PIN login, walk-in + takeaway orders, print bill
- ✅ **Takeaway display:** public screen `/takeaway/:tenant`, live order queue grouped by status (Pending/Preparing/Ready), SignalR-driven; backend `GET /orders/takeaway-board` (AllowAnonymous)

---

## Sprint 9 — Cloud Deployment & CI/CD ❌ NOT STARTED

Planned: Azure App Service, Azure PostgreSQL Flexible Server, Blob Storage + CDN, Key Vault + Managed Identity, Static Web Apps, GitHub Actions pipelines, Application Insights, subdomain routing (`{tenant}.tabhub.tn`), SSL.

---

## Sprint 10 — Hardening & Demo Preparation ❌ NOT STARTED

Planned: E2E test suite, security audit (CORS, rate limiting, FluentValidation, SQL injection review), SignalR load test (50 devices), Arabic RTL QA, onboarding wizard, graduation report.

---

## Blocking Dependencies

Before Sprint 7 (Waiter App) can start, these must be done:
1. **Table sessions** (Sprint 3) — waiter moves/merges tables, closes sessions
2. **Notification persistence + ACK** (Sprint 4) — competing consumer pattern
3. **Modifier groups** (Sprint 2) — waiter validates items with modifiers
