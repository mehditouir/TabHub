# TabHub — Local Testing Guide

Everything in TabHub can be tested fully locally with zero external services.
The only optional external dependency is Azure Blob Storage for image uploads — a local file fallback is active by default.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — for PostgreSQL
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) — for the backend
- [Node.js 20+](https://nodejs.org/) — for frontend and mobile

---

## Step 1 — Start PostgreSQL

```bash
docker-compose up -d
```

This starts the `tabhub_postgres` container on port **5432**.
The DB is initialized from `scripts/db-init.sql` on first run (fresh volume).
It pre-creates two tenant schemas: `cafetunisia` and `restauranttunisia`.

> **Re-applying the schema after changes:**
> ```bash
> docker exec -i tabhub_postgres psql -U postgres -d tabhub < scripts/db-init.sql
> ```

---

## Step 2 — Start the Backend API

```bash
cd backend
dotnet run --project TabHub.API
```

Backend runs on **http://localhost:5195**.
Swagger UI is available at **http://localhost:5195/swagger** — use it to seed data (create staff, tables, menu items) before testing the apps.

SignalR hub is at **http://localhost:5195/hubs/orders**.

---

## Step 3 — Start the Frontend (Web App)

```bash
cd frontend
npm install       # first time only
npm run dev
```

Frontend runs on **http://localhost:5173**.

All web surfaces are served from this single dev server:

| URL | Surface | Auth |
|-----|---------|------|
| `http://localhost:5173/manager` | Manager dashboard | Email + password |
| `http://localhost:5173/menu/cafetunisia?table=<qrToken>` | Customer QR menu | None |
| `http://localhost:5173/kitchen/cafetunisia` | Kitchen display | Staff PIN (role: Kitchen) |
| `http://localhost:5173/cashier/cafetunisia` | Cashier kiosk | Staff PIN (role: Cashier) |
| `http://localhost:5173/waiter/cafetunisia` | Waiter tablet app | Staff PIN (role: Waiter) |
| `http://localhost:5173/takeaway/cafetunisia` | Takeaway board | None |

> Replace `cafetunisia` with any tenant slug you have seeded.
> Get `<qrToken>` from `GET /tables` in Swagger or from the Spaces page in the manager dashboard.

---

## Full End-to-End Flow

Open all surfaces simultaneously in separate browser tabs/windows to observe real-time SignalR updates across them all:

1. **Manager** (`/manager`) — log in, go to Spaces, copy a table's QR token.
2. **Customer** (`/menu/cafetunisia?table=<qrToken>`) — browse menu, add items, place order.
3. **Waiter** (`/waiter/cafetunisia`) — notification banner appears, ACK it, advance order.
4. **Kitchen** (`/kitchen/cafetunisia`) — order appears in Pending column; click Commencer → InProgress, then Prêt → Ready.
5. **Cashier** (`/cashier/cafetunisia`) — go to Sessions tab, close the session, print PDF bill.
6. **Takeaway board** (`/takeaway/cafetunisia`) — place a takeaway order from Cashier and watch it appear live.

---

## Automated Tests

### Backend (xUnit + Testcontainers)

Testcontainers spins up a real PostgreSQL instance per test run — no local DB required.

```bash
cd backend
dotnet test
```

### Frontend (Vitest + MSW)

MSW intercepts API calls — no backend required.

```bash
cd frontend
npm test
```

---

## Notes

- **Image uploads** — stored in `backend/TabHub.API/wwwroot/uploads/` locally (no Azure config needed). Set `AzureBlobStorage:ConnectionString` in `appsettings.Development.json` to test the Azure path.
- **PDF bills** — generated in-process by QuestPDF, no external service.
- **Tenant routing** — locally uses the `X-Tenant` header/query param. Subdomain routing (`{tenant}.tabhub.tn`) is a Sprint 9 / production concern.
- **Multiple tenants** — switch between `cafetunisia` and `restauranttunisia` by changing the slug in the URL or login screen to verify tenant isolation.
