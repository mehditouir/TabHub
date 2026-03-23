# TabHub — File Map

> Auto-maintained index. Update on every file create / modify / delete.

---

## Root

```
CLAUDE.md                     — Project overview: stack, entry points, reference to FILEMAP.md
FILEMAP.md                    — This file; 1-line description of every source file in the repo
PROGRESS.md                   — Sprint-by-sprint progress tracker; updated on every feature change
REGRESSION.md                 — 83 manual test scenarios covering all surfaces end-to-end
TODO.md                       — Sprint 10 deferred tasks: load test, demo data, graduation report, E2E Playwright suite
.env.example                  — Template env vars (Postgres + ASP.NET); copy to .env for local dev
.gitignore                    — Git ignore patterns for backend/frontend build artifacts
docker-compose.yml            — Starts postgres:15-alpine on port 5432; mounts db-init.sql as entrypoint seed
global.json                   — Pins .NET SDK to 8.0.416 with latestPatch rollForward
nuget.config                  — Clears package sources; points exclusively to nuget.org v3 feed
TabHub.sln                    — Visual Studio solution file linking TabHub.API and TabHub.Tests
README.md                     — Project readme
```

---

## .github/workflows/

```
.github/workflows/infra.yml      — Deploys Bicep to Azure on push to infra/**; creates resource group if needed; prints outputs on first run
.github/workflows/backend.yml    — dotnet build (API + Tests) → test (Testcontainers) → publish → zip deploy to App Service; health check smoke test
.github/workflows/frontend.yml   — npm ci → test → build (VITE_API_URL injected) → deploy to Static Web Apps on push to frontend/**
```

---

## infra/

```
infra/main.bicep                  — Orchestrates all Azure resources; derives resource names from namePrefix; outputs apiUrl + swaUrl + swaDeploymentToken
infra/main.parameters.json        — Parameter file; secrets reference a bootstrap Key Vault (fill SUBSCRIPTION_ID + RESOURCE_GROUP)
infra/modules/appinsights.bicep   — Log Analytics workspace (PerGB2018, 30-day retention) + Application Insights component
infra/modules/storage.bicep       — Storage account (Standard_LRS) + public blob container tabhub-images; outputs connection string
infra/modules/staticwebapp.bicep  — Static Web App free tier; outputs defaultHostname + deploymentToken
infra/modules/postgres.bicep      — PostgreSQL Flexible Server B1ms v15 + tabhub database + AllowAzureServices firewall rule; outputs FQDN
infra/modules/appservice.bicep    — App Service Plan B1 Linux + Web App (.NET 8, system-assigned identity, WebSockets on, alwaysOn); outputs principalId
infra/modules/keyvault.bicep      — Key Vault (RBAC mode) + 3 secrets (db-connection-string, jwt-key, storage-connection-string) + Secrets User role for App Service identity
infra/modules/appsettings.bicep   — Web App config resource with all app settings + Key Vault references; deployed last (no circular dep)
```

---

## .vscode/

```
.vscode/extensions.json       — Recommends C# Dev Kit, OmniSharp, NuGet GUI, Mermaid extensions
.vscode/launch.json           — Debug configs: Backend (API), Frontend (Vite), Full Stack compound
.vscode/settings.json         — Workspace settings: C# formatter, file nesting, build artifact exclusions
.vscode/tasks.json            — Tasks: backend build/watch, frontend dev, restore, publish
```

---

## scripts/

```
scripts/db-init.sql           — Creates public.tenants, cafetunisia + restauranttunisia schemas, all tables; seeds dev manager account
```

---

## backend/TabHub.API/

```
TabHub.API.csproj             — .NET 8 Web API project: EF Core, Npgsql, JWT Bearer, Argon2, Swagger, FluentValidation, Application Insights
Program.cs                    — App bootstrap: CORS, JWT, EF Core, SignalR, Swagger, Application Insights, middleware pipeline
appsettings.json              — Base config: JWT placeholder key, AllowedHosts
appsettings.Development.json  — Dev overrides: Postgres connection string, JWT dev key, token expiry timings
Properties/launchSettings.json — dotnet run profiles: http (port 5195), https
TabHub.API.http               — VS Code HTTP client scratch file for quick manual API calls
```

### backend/TabHub.API/Migrations/

```
Migrations/20260318222448_InitialPublicSchema.cs          — EF migration: creates managers, refresh_tokens, manager_tenants
Migrations/20260318222448_InitialPublicSchema.Designer.cs — Auto-generated EF migration designer snapshot
Migrations/AppDbContextModelSnapshot.cs                   — Auto-generated EF Core model snapshot for migration tooling
```

### backend/TabHub.API/src/API/Controllers/

```
src/API/Controllers/AuthController.cs        — Manager register/login/refresh/logout; staff PIN login; issues JWT + refresh cookie
src/API/Controllers/SuperAdminController.cs  — Super admin: POST /admin/auth/login, GET/POST /admin/tenants, GET/POST /admin/managers, POST /admin/tenants/{id}/managers
src/API/Controllers/CategoriesController.cs  — CRUD for menu categories + per-language translation upsert; manager auth
src/API/Controllers/ConfigController.cs      — GET/PUT tenant key-value config store; manager auth
src/API/Controllers/HealthController.cs      — GET /health: pings DB via SELECT 1; returns tenant slug and status
src/API/Controllers/IngredientsController.cs — CRUD for ingredients + translations + item linking + cascade-disable
src/API/Controllers/MenuController.cs        — GET /menu: public, returns active categories with available items + modifiers
src/API/Controllers/MenuItemsController.cs   — CRUD for menu items + translation upsert + POST /{id}/image upload
src/API/Controllers/MenusController.cs       — Menus CRUD + translations + schedule rules + GET /menus/active engine
src/API/Controllers/ModifiersController.cs   — ModifierGroups and ModifierOptions CRUD + translations
src/API/Controllers/OrdersController.cs      — Customer QR orders (Pending, auto-links session); staff dine-in bypass (InProgress); takeaway with sequence; PDF bill; advance/cancel; call-waiter; request-bill; public takeaway-board endpoint; SignalR broadcasts
src/API/Controllers/NotificationsController.cs    — GET /notifications (list unacked), GET /{id}, PUT /{id}/ack competing consumer ACK with FOR UPDATE row lock
src/API/Controllers/SessionsController.cs    — Table sessions CRUD: open, close, move to table, merge two sessions; audit on all ops
src/API/Controllers/ReportsController.cs     — Revenue by day, top items, order summary, busiest hours; manager auth
src/API/Controllers/SpacesController.cs      — CRUD for dining spaces + translation upsert; manager auth
src/API/Controllers/StaffController.cs       — CRUD for staff + PIN change + waiter zone add/remove
src/API/Controllers/TablesController.cs      — CRUD for restaurant tables (col/row/qrToken) within spaces; manager auth; GET /tables/resolve (public) maps qrToken → tableId
src/API/Controllers/TenantControllerBase.cs  — Abstract base: [ApiController] + [Authorize] + TenantCtx accessor
```

### backend/TabHub.API/src/API/Dtos/

```
src/API/Dtos/AuthDtos.cs       — Records: RegisterManagerRequest, LoginRequest, StaffPinLoginRequest, LoginResponse, StaffLoginResponse, CreateTenantRequest, AdminCreateManagerRequest, AssignManagerRequest
src/API/Dtos/CategoryDtos.cs   — Records: CreateCategoryRequest, UpdateCategoryRequest, CategoryDto, CategoryTranslationDto
src/API/Dtos/ConfigDtos.cs     — Record: SetConfigRequest (single Value string)
src/API/Dtos/IngredientDtos.cs — Records: CreateIngredientRequest, UpdateIngredientRequest, IngredientDto, IngredientTranslationDto
src/API/Dtos/MenuDtos.cs       — Records: CreateMenuRequest, UpdateMenuRequest, MenuDto, ScheduleRuleDto, ActiveMenuResponse, ActiveMenuDto
src/API/Dtos/MenuItemDtos.cs   — Records: CreateMenuItemRequest, UpdateMenuItemRequest, MenuItemDto, PublicMenuItemDto, PublicMenuResponse + modifier DTOs
src/API/Dtos/ModifierDtos.cs   — Records: CreateModifierGroupRequest, ModifierGroupDto, CreateModifierOptionRequest, ModifierOptionDto
src/API/Dtos/OrderDtos.cs      — Records: CreateOrderRequest, StaffCreateOrderRequest, CreateTakeawayOrderRequest, UpdateOrderStatusRequest, CustomerTableRequest, OrderDto (with orderType/sequenceNumber), OrderItemDto
src/API/Dtos/NotificationDtos.cs   — Record: NotificationDto (with embedded OrderDto)
src/API/Dtos/SessionDtos.cs    — Records: OpenSessionRequest, MoveSessionRequest, MergeSessionRequest, SessionDto
src/API/Dtos/ReportDtos.cs     — Records: RevenueDayDto, RevenueReportDto, TopItemDto, OrderSummaryDto, BusyHourDto
src/API/Dtos/SpaceDtos.cs      — Records: CreateSpaceRequest, UpdateSpaceRequest, SpaceDto, SpaceTranslationDto
src/API/Dtos/StaffDtos.cs      — Records: CreateStaffRequest, UpdateStaffRequest, SetPinRequest, StaffDto, WaiterZoneDto
src/API/Dtos/TableDtos.cs      — Records: CreateTableRequest, UpdateTableRequest, TableDto
```

### backend/TabHub.API/src/API/Filters/

```
src/API/Filters/TenantAuthorizationFilter.cs   — Validates JWT tenant_id matches resolved tenant; blocks cross-tenant token reuse
```

### backend/TabHub.API/src/API/Swagger/

```
src/API/Swagger/TenantHeaderOperationFilter.cs — Injects required X-Tenant header parameter into every Swagger operation
```

### backend/TabHub.API/src/Domain/Entities/

```
src/Domain/Entities/AuditLog.cs             — Audit log entity: action, entity type/id, actor info, before/after JSONB
src/Domain/Entities/AuditLog.cs                   — Audit log entity: action, entity type/id, actor info, before/after JSONB
src/Domain/Entities/Category.cs                   — Menu category: name, sortOrder, isActive, soft-delete, translations + items nav
src/Domain/Entities/CategoryTranslation.cs        — Category name translation keyed by (categoryId, language)
src/Domain/Entities/Config.cs                     — Tenant config key-value entity with updatedAt
src/Domain/Entities/Ingredient.cs                 — Ingredient: name, isActive, soft-delete; cascades item disable on deactivation
src/Domain/Entities/IngredientTranslation.cs      — Ingredient name translation keyed by (ingredientId, language)
src/Domain/Entities/Manager.cs                    — Manager account: email, Argon2 passwordHash, displayName, isActive
src/Domain/Entities/ManagerTenant.cs              — Join entity: Manager ↔ Tenant with role (Owner/Admin)
src/Domain/Entities/Menu.cs                       — Named menu container: isActive toggle, sortOrder, schedule rules, categories
src/Domain/Entities/MenuCategory.cs               — Join table: Menu ↔ Category (many-to-many)
src/Domain/Entities/MenuItemIngredient.cs         — Join table: MenuItem ↔ Ingredient (many-to-many)
src/Domain/Entities/MenuItem.cs                   — Menu item: price, imageUrl, sortOrder, isAvailable, modifier groups, ingredients
src/Domain/Entities/MenuItemTranslation.cs        — Menu item name+description translation keyed by (itemId, language)
src/Domain/Entities/MenuScheduleRule.cs           — Schedule rule for a menu: TimeRange / DayOfWeek / DateRange (AND-logic)
src/Domain/Entities/MenuTranslation.cs            — Menu name translation keyed by (menuId, language)
src/Domain/Entities/ModifierGroup.cs              — Modifier group on a menu item: isRequired, min/maxSelections, options
src/Domain/Entities/ModifierGroupTranslation.cs   — Modifier group name translation keyed by (modifierGroupId, language)
src/Domain/Entities/ModifierOption.cs             — Modifier option: name, priceDelta, isAvailable, sortOrder
src/Domain/Entities/ModifierOptionTranslation.cs  — Modifier option name translation keyed by (modifierOptionId, language)
src/Domain/Entities/Notification.cs               — Notification: eventType, orderId, tableId, ack state; created on OrderPlaced for zone routing
src/Domain/Entities/Order.cs                      — Order: tableId (nullable), sessionId, orderType, sequenceNumber, status, notes; Total computed from items sum
src/Domain/Entities/TableSession.cs               — Table session: links table to a dining period; open/closed timestamps, optional staff ref
src/Domain/Entities/OrderItem.cs                  — Order line: snapshots menuItemName + unitPrice at order creation time
src/Domain/Entities/RefreshToken.cs               — Refresh token: SHA256 hash, expiry, revocation timestamp
src/Domain/Entities/RestaurantTable.cs            — Table: col/row grid position, unique qrToken (UUID), soft-delete
src/Domain/Entities/Space.cs                      — Dining space: cols×rows grid definition, sortOrder, isActive, soft-delete
src/Domain/Entities/SpaceTranslation.cs           — Space name translation keyed by (spaceId, language)
src/Domain/Entities/Staff.cs                      — Staff member: displayName, StaffRole, BCrypt pinHash, isActive, soft-delete
src/Domain/Entities/Tenant.cs                     — Tenant (public schema): slug, schemaName, name, TenantStatus
src/Domain/Entities/WaiterZone.cs                 — Waiter zone: links staff to a rectangular grid region (col/row bounds) in a space
```

### backend/TabHub.API/src/Domain/Enums/

```
src/Domain/Enums/AuditActorType.cs    — Enum: Manager, Staff, System
src/Domain/Enums/OrderType.cs         — Enum: DineIn, Takeaway
src/Domain/Enums/Language.cs          — Enum: FR, AR, EN
src/Domain/Enums/ManagerRole.cs       — Enum: Owner, Admin
src/Domain/Enums/OrderStatus.cs       — Enum: Pending, InProgress, Ready, Completed, Cancelled
src/Domain/Enums/ScheduleRuleType.cs  — Enum: TimeRange, DayOfWeek, DateRange
src/Domain/Enums/StaffRole.cs         — Enum: Waiter, Kitchen, Cashier
src/Domain/Enums/TenantStatus.cs      — Enum: Active, Suspended, Trial, Cancelled
```

### backend/TabHub.API/src/Infrastructure/Auth/

```
src/Infrastructure/Auth/ArgonHasher.cs          — Argon2id password hasher; stored format: "v1:{base64 salt}:{base64 hash}"
src/Infrastructure/Auth/CurrentActorAccessor.cs — Reads actor_type, sub, name, tenant_id claims from current JWT via IHttpContextAccessor
src/Infrastructure/Auth/ICurrentActor.cs        — Interface: ActorType, ActorId, ActorDisplay, TenantId
src/Infrastructure/Auth/JwtSettings.cs          — Config POCO: Key, Issuer, Audience, AccessTokenMinutes, RefreshTokenDays
src/Infrastructure/Auth/PinHasher.cs            — BCrypt hasher (work factor 10) for staff PINs
src/Infrastructure/Auth/TokenService.cs         — Generates manager/staff/superadmin JWTs (HS256) and SHA256-hashed refresh tokens
src/Infrastructure/Auth/Validators/AuthValidators.cs — FluentValidation validators: LoginRequest, StaffPinLoginRequest, RegisterManagerRequest, CreateTenantRequest, AdminCreateManagerRequest
```

### backend/TabHub.API/src/Infrastructure/Middleware/

```
src/Infrastructure/Middleware/ExceptionMiddleware.cs — Catches unhandled exceptions; logs error; returns structured JSON 500 { error: "An unexpected error occurred." }
```

### backend/TabHub.API/src/Infrastructure/Multitenancy/

```
src/Infrastructure/Multitenancy/TenantCache.cs      — IMemoryCache wrapper; caches TenantContext by slug for 5 minutes
src/Infrastructure/Multitenancy/TenantContext.cs    — Immutable record carrying TenantId, Slug, SchemaName for the request
src/Infrastructure/Multitenancy/TenantMiddleware.cs — Resolves X-Tenant from header or query param (SignalR) → TenantContext; opens DB connection; sets search_path; bypasses /health and /admin
```

### backend/TabHub.API/src/Infrastructure/Persistence/

```
src/Infrastructure/Persistence/AppDbContext.cs      — EF DbContext: public + tenant schema entities, snake_case naming, SetSearchPathAsync
src/Infrastructure/Persistence/SchemaProvisioner.cs — Creates new tenant schema + all tenant tables via idempotent raw DDL
```

### backend/TabHub.API/src/Infrastructure/Realtime/

```
src/Infrastructure/Realtime/OrderHub.cs  — SignalR hub at /hubs/orders; joins tenant/manager/staff/table groups on connect; JoinTableGroup method; BroadcastCart method for shared customer cart (OthersInGroup)
```

### backend/TabHub.API/src/Infrastructure/Services/

```
src/Infrastructure/Services/AuditService.cs        — Writes audit_logs with before/after JSON snapshots; system overload for anonymous events
src/Infrastructure/Services/ImageStorageService.cs — IImageStorageService: resizes uploads to WebP 400×400; BlobImageStorageService (Azure) or LocalImageStorageService (wwwroot/uploads)
```

---

## backend/TabHub.Tests/

```
TabHub.Tests.csproj  — Test project: xUnit, FluentAssertions, NSubstitute, Testcontainers.PostgreSql, MvcTesting
```

### backend/TabHub.Tests/Integration/

```
Integration/TestWebAppFactory.cs  — Spins up real API in-memory + throwaway Postgres container; seeds db-init.sql; runs EF migrations
```

### backend/TabHub.Tests/Integration/Auth/

```
Integration/Auth/AuthTests.cs         — Integration tests: register, login, refresh, logout, staff PIN login
Integration/Auth/AuthAdvancedTests.cs — Integration tests: token expiry, cross-tenant rejection, refresh rotation
```

### backend/TabHub.Tests/Integration/Categories/

```
Integration/Categories/CategoriesTests.cs        — Integration tests: full CRUD + translation upsert for categories
Integration/Categories/CategoryIntegrityTests.cs — Integration tests: soft-delete, inactive filtering, conflict scenarios
```

### backend/TabHub.Tests/Integration/Config/

```
Integration/Config/ConfigTests.cs  — Integration tests: GET/PUT config key-value pairs
```

### backend/TabHub.Tests/Integration/Health/

```
Integration/Health/HealthEndpointTests.cs  — Integration tests: GET /health with valid and unknown tenant
```

### backend/TabHub.Tests/Integration/Menu/

```
Integration/Menu/PublicMenuTests.cs  — Integration tests: public GET /menu filtering active categories and available items
```

### backend/TabHub.Tests/Integration/MenuItems/

```
Integration/MenuItems/MenuItemsTests.cs        — Integration tests: full CRUD + translation upsert for menu items
Integration/MenuItems/MenuItemIntegrityTests.cs — Integration tests: soft-delete, category FK, availability filtering
```

### backend/TabHub.Tests/Integration/Orders/

```
Integration/Orders/OrdersTests.cs        — Integration tests: place order, list, advance status, cancel
Integration/Orders/OrderIntegrityTests.cs — Integration tests: invalid QR token, empty cart, unavailable items
```

### backend/TabHub.Tests/Integration/Realtime/

```
Integration/Realtime/OrderHubTests.cs  — Integration tests: SignalR connect; OrderPlaced/StatusChanged/Cancelled events
```

### backend/TabHub.Tests/Integration/Reports/

```
Integration/Reports/ReportsTests.cs  — Integration tests: revenue, top-items, orders/summary, busiest-hours endpoints
```

### backend/TabHub.Tests/Integration/Spaces/

```
Integration/Spaces/SpacesTests.cs        — Integration tests: full CRUD + translation upsert for spaces
Integration/Spaces/SpaceIntegrityTests.cs — Integration tests: soft-delete, grid size constraints
```

### backend/TabHub.Tests/Integration/Staff/

```
Integration/Staff/StaffTests.cs        — Integration tests: full CRUD + PIN change for staff
Integration/Staff/StaffIntegrityTests.cs — Integration tests: soft-delete, inactive filtering, duplicate detection
```

### backend/TabHub.Tests/Integration/Tables/

```
Integration/Tables/TablesTests.cs        — Integration tests: full CRUD + QR token uniqueness for tables
Integration/Tables/TableIntegrityTests.cs — Integration tests: space FK enforcement, soft-delete, active filtering
```

### backend/TabHub.Tests/Integration/TenantIsolation/

```
Integration/TenantIsolation/TenantIsolationTests.cs      — Integration tests: data isolation between tenant schemas
Integration/TenantIsolation/MenuTenantIsolationTests.cs  — Integration tests: menu items isolated per tenant
Integration/TenantIsolation/OrderTenantIsolationTests.cs — Integration tests: orders isolated per tenant
```

### backend/TabHub.Tests/Integration/WaiterZones/

```
Integration/WaiterZones/WaiterZonesTests.cs  — Integration tests: add, list, remove waiter zones for staff members
```

---

## frontend/

```
.env.example          — Frontend env template: VITE_API_URL=http://localhost:5000
.env.local            — Local dev env override: VITE_API_URL=http://localhost:5195
eslint.config.js      — ESLint flat config: TypeScript, react-hooks, react-refresh plugins
index.html            — HTML shell: #root div, PWA meta tags, loads /src/main.tsx
public/staticwebapp.config.json — Azure Static Web Apps SPA routing fallback + security headers (X-Content-Type-Options, X-Frame-Options)
package.json          — npm manifest: React 19, Vite 8, Tailwind, SignalR, qrcode, MSW, Vitest
postcss.config.cjs    — PostCSS config: tailwindcss + autoprefixer plugins
tailwind.config.ts    — Tailwind config: extends brand color #f97316 (orange-500)
tsconfig.app.json     — TypeScript strict config: erasableSyntaxOnly, verbatimModuleSyntax, noUnusedLocals
tsconfig.json         — Root TS config referencing tsconfig.app.json and tsconfig.node.json
tsconfig.node.json    — TS config for Vite config files (Node environment)
vite.config.ts        — Vite config: React plugin, PWA standalone + /menu NetworkFirst cache, @/ alias
vitest.config.ts      — Vitest config: jsdom environment, globals true, @/ alias, setup.ts
```

### frontend/src/

```
src/App.css     — App-level CSS (minimal; Tailwind handles styling)
src/App.tsx     — Root component: renders RouterProvider with the app router
src/index.css   — Global CSS: Tailwind directives, body margin reset, #root fills viewport
src/main.tsx    — React entry point: mounts App in StrictMode to #root; imports i18n setup
src/router.tsx  — All routes: /menu/:tenant, /login, /staff/*, /manager/* (dashboard/menu/spaces/staff/config), /admin/login, /admin; RequireAuth + RequireAdminAuth guards
```

### frontend/src/i18n/

```
src/i18n/index.ts              — i18next init: FR/AR/EN resources, persists selection to localStorage, sets document dir/lang
src/i18n/locales/en.json       — English translations (nav, common, dashboard, menu, spaces, staff, customer, config)
src/i18n/locales/fr.json       — French translations (same sections)
src/i18n/locales/ar.json       — Arabic translations (same sections)
```

### frontend/src/components/

```
src/components/StaffPinLogin.tsx  — Reusable PIN keypad login panel for kitchen/cashier; validates role after login; stores token in localStorage
```

### frontend/src/components/layout/

```
src/components/layout/ManagerLayout.tsx  — Sidebar layout: Dashboard/Menu/Spaces/Staff/Settings nav, language switcher (FR/AR/EN), sign out
src/components/layout/StaffLayout.tsx    — Full-screen dark kiosk layout; calls useKiosk() for fullscreen request
```

### frontend/src/components/orders/

```
src/components/orders/OrderCard.tsx       — Renders order: items list, total price, advance/cancel buttons calling API
src/components/orders/OrderCard.test.tsx  — Tests: renders order data, advance button, cancel confirm dialog
src/components/orders/StatusBadge.tsx     — Colored badge per OrderStatus; exports NEXT_STATUS map for staff actions
src/components/orders/StatusBadge.test.tsx — Tests: correct color and label for each order status
```

### frontend/src/components/ui/

```
src/components/ui/Badge.tsx       — Colored pill badge: gray/yellow/blue/orange/green/red variants
src/components/ui/Badge.test.tsx  — Tests: renders children, applies correct Tailwind color class
src/components/ui/Button.tsx      — Styled button: primary/secondary/danger/ghost variants; sm/md/lg sizes
src/components/ui/Button.test.tsx — Tests: renders, variant classes, disabled state behavior
src/components/ui/Input.tsx       — Labeled input with optional error message; forwards all HTML input attributes
src/components/ui/Input.test.tsx  — Tests: label renders, error styling, attribute forwarding
```

### frontend/src/lib/api/

```
src/lib/api/admin.ts       — adminLogin, getTenants, createTenant, getManagers, createManager, assignManager; saveAdminToken/clearAdminToken/getAdminToken
src/lib/api/auth.ts        — login(manager), logout, staffPinLogin(tenant, pin) — manager + staff PIN auth
src/lib/api/client.ts      — apiFetch<T>(): attaches JWT + X-Tenant headers; throws ApiError on non-2xx; hubUrl(); customerHubUrl(tenant, tableId?)
src/lib/api/client.test.ts — Tests: correct headers sent, ApiError thrown on 4xx/5xx, 204 returns undefined
src/lib/api/config.ts      — getConfig() → Record<string,string>; setConfig(key, value) → upserts via PUT /config/{key}
src/lib/api/menu.ts        — getPublicMenu(); getCategories/create/update/delete; getMenuItems/create/update/delete; uploadMenuItemImage()
src/lib/api/orders.ts      — placeOrder(), callWaiter(), requestBill() (anon); getOrders/getOrder/updateOrderStatus/cancelOrder/placeStaffOrder/placeTakeawayOrder/fetchBillBlobUrl (auth)
src/lib/api/reports.ts     — getRevenue(), getTopItems(), getOrderSummary(), getBusiestHours()
src/lib/api/notifications.ts — ackNotification(id) — competing-consumer ACK, 409 = already taken
src/lib/api/sessions.ts    — getSessions(isOpen?), closeSession, moveSession, mergeSession
src/lib/api/spaces.ts      — getSpaces/create/update/delete; getTables/create/update/delete (with spaceId filter); resolveTable(tenant, qrToken) public
src/lib/api/staff.ts       — getStaff/create/update/setPin/delete; getWaiterZones/createWaiterZone/deleteWaiterZone
```

### frontend/src/lib/hooks/

```
src/lib/hooks/useAuth.ts       — login/logout; decodes JWT; persists token + tenant slug in localStorage
src/lib/hooks/useAuth.test.ts  — Tests: login sets localStorage keys, logout clears, JWT payload decoded correctly
src/lib/hooks/useKiosk.ts      — Requests fullscreen on mount; re-requests on fullscreenchange exit
src/lib/hooks/useOrderHub.ts   — SignalR connection; handles OrderPlaced/StatusChanged/Cancelled + NewOrderNotification; auto-rejoin on reconnect
src/lib/hooks/useWaiterHub.ts  — SignalR hub for waiter app; handles all 6 event types (OrderPlaced/StatusChanged/Cancelled/NewOrderNotification/WaiterCalled/BillRequested); returns orders + alerts
```

### frontend/src/lib/

```
src/lib/types.ts       — All TypeScript interfaces mirroring backend DTOs (Auth, Menu+Modifiers, Orders, Reports, Management, WaiterZone, TableResolveResponse, CartSyncItem)
src/lib/utils.ts       — cn(), formatPrice() (TND 3 decimals), formatTime(), formatDate()
src/lib/utils.test.ts  — Tests: cn class merging, formatPrice output, formatTime/formatDate formatting
```

### frontend/src/pages/

```
src/pages/CustomerMenu.tsx       — Public QR menu: browse categories/items, modifier selection modal, floating cart, place order, live order tracking (SignalR), call waiter/request bill
src/pages/CustomerMenu.test.tsx  — Tests: renders menu items, add to cart, submit order flow
src/pages/TakeawayDisplay.tsx    — Public takeaway board (/takeaway/:tenant): live order queue grouped by status (Pending/Preparing/Ready), SignalR-driven, no auth required
src/pages/KitchenApp.tsx         — Kitchen display (/kitchen/:tenant): PIN login (kitchen role), two-column kanban (Pending/InProgress), advance + reject, SignalR-driven, elapsed time indicator
src/pages/CashierApp.tsx         — Cashier kiosk (/cashier/:tenant): PIN login (cashier role), New Order tab (takeaway/table + item picker + cart), Sessions tab (close session + PDF bill)
src/pages/WaiterApp.tsx          — Waiter tablet app (/waiter/:tenant): PIN login (waiter role), floor plan grid with zone highlighting, orders tab with advance/cancel, sessions tab (move/merge/close+bill), place order modal, notification banner with ACK
src/pages/Login.tsx              — Login form: tenant slug + email + password; redirects by role after JWT decode
src/pages/admin/AdminLogin.tsx   — Super admin login (no tenant); stores token in tabhub_admin_token; redirects to /admin
src/pages/admin/AdminDashboard.tsx — Admin dashboard: Tenants tab (list + create), Managers tab (list + create + assign to tenant)
src/pages/Login.test.tsx         — Tests: form submission, error display, role-based redirect
```

### frontend/src/pages/manager/

```
src/pages/manager/Config.tsx          — Settings page: restaurant name, TVA rate, default language, per-day opening hours
src/pages/manager/Dashboard.tsx       — KPI cards (order counts), avg completion time, 30-day revenue chart, top items list; i18n
src/pages/manager/Dashboard.test.tsx  — Tests: KPI values, revenue total, top items rendered from MSW fixtures
src/pages/manager/Menu.tsx            — Category accordion + item rows; create/edit/delete modals; photo upload for items; i18n
src/pages/manager/Spaces.tsx          — Space list + 3 tabs: Editor (grid + QR modals), Live (real-time table status), Zones (waiter zone drag-assign); i18n
src/pages/manager/Staff.tsx           — Staff list with role badges; create/edit/delete modal with separate PIN management; i18n
```

### frontend/src/pages/staff/

```
src/pages/staff/Orders.tsx       — Live order queue via SignalR; status filter tabs; OrderCard grid layout
src/pages/staff/Orders.test.tsx  — Tests: renders orders, filter by status, advance/cancel via MSW handlers
```

### frontend/src/test/

```
src/test/setup.ts             — MSW server lifecycle: beforeAll listen, afterEach reset, afterAll close
src/test/mocks/fixtures.ts    — Typed test data: Pending/InProgress/Completed orders, menu, summary, revenue
src/test/mocks/handlers.ts    — MSW request handlers for auth, menu, orders, reports endpoints
src/test/mocks/server.ts      — Creates msw setupServer with all handlers
```

---

## documentation/

```
documentation/sprint-plan.md    — 10-sprint project timeline (2 weeks each, W1–W22, internship graduation project)
documentation/diagrams/README.md — Index of all Mermaid diagrams organized by sprint
```

### documentation/diagrams/ (cross-sprint reference diagrams)

```
documentation/diagrams/01-architecture-deployment.md      — System architecture and deployment topology diagram
documentation/diagrams/02-erd-platform-schema.md          — ERD: public schema (managers, tenants, manager_tenants)
documentation/diagrams/03-erd-setup-schema.md             — ERD: tenant setup tables (spaces, tables, staff, waiter_zones)
documentation/diagrams/04-erd-menus-schema.md             — ERD: menu tables (categories, items, translations)
documentation/diagrams/05-erd-orders-schema.md            — ERD: orders and order_items tables
documentation/diagrams/06-usecase.md                      — Use case diagram for all three surfaces (customer, staff, manager)
documentation/diagrams/07-class-domain.md                 — Domain model class diagram
documentation/diagrams/08-sequence-qr-scan-to-order.md   — Sequence: customer scans QR → places order
documentation/diagrams/09-sequence-waiter-validation.md  — Sequence: waiter validates and advances an order
documentation/diagrams/10-sequence-kitchen-flow.md        — Sequence: kitchen display receives and completes an order
documentation/diagrams/11-sequence-signalr-notification-ack.md — Sequence: SignalR broadcast and client acknowledgment
documentation/diagrams/12-sequence-auth.md                — Sequence: manager login + refresh token rotation
documentation/diagrams/13-sequence-table-operations.md   — Sequence: table creation, QR generation, activation
documentation/diagrams/14-sequence-menu-scheduling.md    — Sequence: planned menu scheduling feature flow
documentation/diagrams/15-sequence-pdf-bill.md            — Sequence: PDF bill generation flow (planned)
documentation/diagrams/16-sequence-takeaway-order.md     — Sequence: takeaway / off-table order flow (planned)
documentation/diagrams/17-sequence-image-upload.md       — Sequence: menu item image upload pipeline (planned)
```

### documentation/diagrams/sprints/

```
documentation/diagrams/sprints/sprint0/01-tech-stack.md              — Sprint 0: tech stack selection diagram
documentation/diagrams/sprints/sprint0/02-monorepo-structure.md      — Sprint 0: monorepo folder structure
documentation/diagrams/sprints/sprint0/03-tenant-middleware-sequence.md — Sprint 0: tenant resolution middleware sequence
documentation/diagrams/sprints/sprint1/01-erd-sprint1.md             — Sprint 1: ERD for auth tables
documentation/diagrams/sprints/sprint1/02-auth-sequence.md           — Sprint 1: manager auth flow sequence
documentation/diagrams/sprints/sprint1/03-restaurant-setup-sequence.md — Sprint 1: restaurant onboarding sequence
documentation/diagrams/sprints/sprint2/01-erd-sprint2.md             — Sprint 2: ERD for menu tables
documentation/diagrams/sprints/sprint2/02-menu-schedule-flowchart.md — Sprint 2: menu scheduling flowchart
documentation/diagrams/sprints/sprint2/03-image-pipeline.md          — Sprint 2: image upload pipeline diagram
documentation/diagrams/sprints/sprint3/01-erd-sprint3.md             — Sprint 3: ERD for orders schema
documentation/diagrams/sprints/sprint3/02-order-status-machine.md    — Sprint 3: order status state machine
documentation/diagrams/sprints/sprint3/03-session-lifecycle.md       — Sprint 3: staff session lifecycle diagram
documentation/diagrams/sprints/sprint4/01-signalr-group-topology.md  — Sprint 4: SignalR per-tenant group topology
documentation/diagrams/sprints/sprint4/02-ack-competing-consumer.md  — Sprint 4: competing consumer acknowledgment pattern
documentation/diagrams/sprints/sprint5/01-dashboard-component-tree.md — Sprint 5: manager dashboard React component tree
documentation/diagrams/sprints/sprint5/02-floor-plan-grid-logic.md   — Sprint 5: floor plan grid rendering logic
documentation/diagrams/sprints/sprint6/01-customer-journey.md        — Sprint 6: customer QR-to-order journey
documentation/diagrams/sprints/sprint6/02-session-state-machine.md   — Sprint 6: customer session state machine
documentation/diagrams/sprints/sprint7/01-waiter-notification-routing.md — Sprint 7: waiter zone-based notification routing
documentation/diagrams/sprints/sprint7/02-waiter-app-flow.md         — Sprint 7: waiter app interaction flow
documentation/diagrams/sprints/sprint8/01-kitchen-state-machine.md   — Sprint 8: kitchen display state machine
documentation/diagrams/sprints/sprint8/02-full-system-simulation.md  — Sprint 8: full end-to-end system simulation
documentation/diagrams/sprints/sprint9/01-azure-infrastructure.md    — Sprint 9: Azure cloud infrastructure diagram
documentation/diagrams/sprints/sprint9/02-cicd-pipeline.md           — Sprint 9: CI/CD pipeline diagram
documentation/diagrams/sprints/sprint10/01-security-layers.md        — Sprint 10: security layers diagram
documentation/diagrams/sprints/sprint10/02-test-strategy.md          — Sprint 10: test strategy overview
```
