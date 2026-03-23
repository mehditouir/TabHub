# TabHub

Multi-tenant SaaS order management platform for restaurants and cafés.
Customers order via QR code, waiters manage tables on tablets, kitchen receives live orders — all connected in real time via SignalR.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 8, EF Core 8, Npgsql |
| Database | PostgreSQL 15 (schema-per-tenant isolation) |
| Real-time | ASP.NET Core SignalR |
| Frontend | React 19 + TypeScript + Vite |
| Cloud | Microsoft Azure (App Service + PostgreSQL Flexible Server + Blob Storage + Static Web Apps) |
| CI/CD | GitHub Actions |

---

## What's built (Sprints 0–8)

### Five live surfaces — all responsive web, single Vite SPA

| Surface | URL pattern | Auth | Role |
|---|---|---|---|
| Customer QR menu | `/menu/:tenant?table=<qrToken>` | None | Customer |
| Takeaway display | `/takeaway/:tenant` | None | TV screen |
| Kitchen display | `/kitchen/:tenant` | Staff PIN | Kitchen |
| Cashier kiosk | `/cashier/:tenant` | Staff PIN | Cashier |
| Waiter tablet | `/waiter/:tenant` | Staff PIN | Waiter |
| Manager dashboard | `/manager/:tenant/*` | Email + password | Owner / Admin |

### Backend API — ASP.NET Core 8

**Identity & auth**
- Manager login (Argon2id passwords, JWT 15 min, httpOnly refresh cookie 30 days)
- Staff PIN login (BCrypt, 12-hour JWT)
- Role-based authorization: Owner, Admin, Waiter, Cashier, Kitchen

**Restaurant setup**
- Spaces CRUD (column × row grids)
- Tables CRUD + QR token (UUID) generation per table
- Staff CRUD + PIN management + waiter zone assignment
- Restaurant config: name, TVA rate, default language, opening hours per day

**Menu system**
- Ingredients CRUD + translations (FR / AR / EN)
- Categories + menu items CRUD + translations + availability toggle
- Menus with schedule rules (TIME_RANGE, DAY_OF_WEEK, DATE_RANGE) + AND-logic activation engine
- Modifier groups + options per item + translations
- Photo upload → resize to WebP 400×400 → Azure Blob Storage (local `wwwroot/uploads/` fallback)
- `GET /menus/active` — public, schedule-filtered, 60s in-memory cache

**Order engine & billing**
- Table sessions: open / close / move / merge
- Orders: table orders + takeaway (daily sequence YYYYMMDDNNNNN)
- Order status machine: Pending → InProgress → Ready → Served / Cancelled
- PDF bill generation (QuestPDF, A5, TVA breakdown, TND with 3-decimal precision)
- Waiter/cashier orders bypass (straight to InProgress)

**Real-time (SignalR)**
- Hub at `/hubs/orders` with per-tenant, per-role, per-staff, per-table groups
- Events: `OrderPlaced`, `OrderStatusChanged`, `OrderCancelled`, `WaiterCalled`, `BillRequested`, `CartUpdated`
- Notification persistence + competing consumer ACK (PostgreSQL `SELECT FOR UPDATE`, first caller wins)
- Zone-based waiter routing: notifications go to waiters whose zones cover the order's table
- Manager fallback when no waiter zone covers the table

**Reports**
- Revenue per period, top items, order summary, busiest hours

**Audit trail**
- Every write operation logged with actor, before/after state snapshot, timestamp

### Frontend — React 19 + TypeScript + Vite

**Manager dashboard**
- Login + role-based redirect
- Sidebar navigation (Dashboard / Menu / Spaces / Staff / Config)
- Dashboard: KPI cards + revenue bar chart + top items list
- Menu page: category accordion + category CRUD modal + item CRUD modal + photo upload
- Spaces page: 3 tabs — Editor (grid), Live (real-time table colours, 30s poll), Zones (waiter zone drag-assign)
- Staff page: list + add/edit/delete modal + PIN management
- Config page: restaurant name, TVA, language, opening hours
- Multilingual UI: i18next, FR / AR / EN, RTL for Arabic, language persisted in localStorage

**Customer ordering interface**
- QR scan → menu browsing → item modifier selection → cart → order submission
- Shared cart across multiple devices on same table (SignalR `CartUpdated`)
- Real-time order status tracking (step indicator, SignalR per-order updates)
- Call waiter button + Request bill button
- Unavailable items shown with badge, greyed out
- Mobile-first responsive design with safe-area support

**Waiter tablet app** (`/waiter/:tenant`)
- Staff PIN keypad login
- Floor plan with assigned zones only, colour-coded table statuses
- Notification overlay: `NewOrderNotification`, `WaiterCalled`, `BillRequested`
- Competing consumer ACK on tap (409 = "already taken")
- Order queue tab with status filters + advance / cancel per order
- Place order from tablet (staff path, starts InProgress)
- Move / merge sessions; close session + PDF bill in iframe

**Kitchen display** (`/kitchen/:tenant`)
- Staff PIN login (Kitchen role)
- Two-column kanban: Pending / InProgress
- Advance (Pending → InProgress → Ready) + reject
- Elapsed time badge per order
- Dark always-on UI, SignalR live

**Cashier kiosk** (`/cashier/:tenant`)
- Staff PIN login (Cashier role)
- New Order tab: Takeaway / Table toggle, menu item picker, cart, submit
- Sessions tab: list open sessions, close + PDF bill modal

**Takeaway display** (`/takeaway/:tenant`)
- Public, no auth
- Live order queue grouped by status (Pending / Preparing / Ready)
- SignalR-driven, no polling

---

## Prerequisites

| Tool | Version |
|---|---|
| .NET SDK | 8.x |
| Node.js | 20 LTS |
| Docker Desktop | latest |
| VS Code | latest |

> The repo includes a `global.json` that pins .NET 8. If you have .NET 9 installed it will be ignored automatically.

---

## Quick start

### 1. Start the database

```bash
docker compose up -d
```

Starts PostgreSQL 15 on `localhost:5432`. Seeds two dev tenants: `cafetunisia` and `restauranttunisia`.

### 2. Start the backend

```bash
cd backend
dotnet run --project TabHub.API
```

API at **http://localhost:5195** — Swagger UI at **http://localhost:5195/swagger**.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

All surfaces at **http://localhost:5173**.

### 4. Log in

Go to `http://localhost:5173/login` — use `mehdi@cafetunisia.com` / `mehdi123`.

See **TESTING.md** for the full end-to-end testing guide.

---

## VS Code setup

### Install recommended extensions

When you open the project, a prompt appears — click **Install All**. This installs:

- **C# Dev Kit** — IntelliSense, go-to-definition, Solution Explorer
- **C#** — Roslyn language server
- **.NET Runtime** — required by the above
- **NuGet Package Manager GUI** — manage packages without leaving VS Code
- **Markdown Mermaid** — renders architecture diagrams inline

### Trust the HTTPS dev certificate (once per machine)

```bash
dotnet dev-certs https --trust
```

---

## VS Code keyboard shortcuts

| Action | Shortcut |
|---|---|
| Quick fix / refactor | `Ctrl+.` |
| Go to definition | `F12` |
| Find all references | `Shift+F12` |
| Rename symbol | `F2` |
| Build | `Ctrl+Shift+B` |
| Terminal | `` Ctrl+` `` |
| Command palette | `Ctrl+Shift+P` |

---

## Project structure

```
TabHub/
├── backend/
│   └── TabHub.API/           # ASP.NET Core 8 Web API
│       ├── Controllers/      # One controller per domain (TenantControllerBase)
│       ├── Entities/         # EF Core entities (soft-delete, audit timestamps)
│       ├── Infrastructure/   # AppDbContext, TenantMiddleware, SchemaProvisioner
│       ├── Hubs/             # SignalR OrderHub
│       └── Services/         # AuditService, ICurrentActor
├── frontend/
│   └── src/
│       ├── pages/            # CustomerMenu, WaiterApp, KitchenApp, CashierApp,
│       │                     # TakeawayDisplay, Login, manager/*
│       ├── components/       # Shared UI + layout (ManagerLayout, StaffLayout)
│       ├── lib/
│       │   ├── api/          # One file per domain (orders, menu, staff, …)
│       │   └── hooks/        # useAuth, useOrderHub, useWaiterHub, …
│       └── i18n/             # FR / AR / EN locale files
├── scripts/
│   └── db-init.sql           # Creates public.tenants + all tenant schema tables;
│                             # seeds cafetunisia + restauranttunisia
├── documentation/
│   ├── sprint-plan.md        # Sprint 0–10 plan with tech justifications
│   └── diagrams/             # Mermaid architecture, ERD, sequence diagrams
├── .vscode/                  # launch.json + tasks.json ("Full Stack" compound config)
├── docker-compose.yml        # PostgreSQL 15 container
├── global.json               # Pins .NET 8 SDK
└── nuget.config              # nuget.org only
```

---

## NuGet packages

```bash
# Add a package
dotnet add backend/TabHub.API/TabHub.API.csproj package <PackageName>

# Remove a package
dotnet remove backend/TabHub.API/TabHub.API.csproj package <PackageName>
```

---

## Diagrams

All architecture, ERD, sequence and flow diagrams are in `documentation/diagrams/`.
Open any `.md` file and press `Ctrl+Shift+V` to preview (requires Markdown Mermaid extension).
