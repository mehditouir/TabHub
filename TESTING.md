# TabHub — Local Testing Guide

Everything in TabHub can be tested fully locally with zero external services.
The only optional external dependency is Azure Blob Storage for image uploads — a local file fallback is active by default.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — for PostgreSQL
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) — for the backend
- [Node.js 20+](https://nodejs.org/) — for the frontend

---

## Step 1 — Start PostgreSQL

```bash
docker-compose up -d
```

This starts the `tabhub_postgres` container on port **5432**.
The DB is initialized from `scripts/db-init.sql` on first run (fresh volume).
It pre-creates two tenant schemas: `cafetunisia` and `restauranttunisia`, each fully seeded with demo data.

> **Re-applying the schema + seed data after changes:**
> ```bash
> docker exec -i tabhub_postgres psql -U postgres -d tabhub < scripts/db-init.sql
> ```
> All INSERTs use `ON CONFLICT … DO NOTHING` — safe to re-run on an existing DB.

---

## Step 2 — Start the Backend API

```bash
cd backend
dotnet run --project TabHub.API
```

Backend runs on **http://localhost:5195**.
Swagger UI is available at **http://localhost:5195/swagger**.

SignalR hub is at **http://localhost:5195/hubs/orders**.

---

## Step 3 — Start the Frontend

```bash
cd frontend
npm install       # first time only
npm run dev
```

Frontend runs on **http://localhost:5173**.

---

## Credentials

All seeded accounts use password **`mehdi123`**.

### Manager accounts

| Email | Password | Tenant | Role |
|-------|----------|--------|------|
| `mehdi@cafetunisia.com` | `mehdi123` | cafetunisia | Owner |
| `mehdi@restauranttunisia.com` | `mehdi123` | restauranttunisia | Owner |
| `mehdi@mehdi.com` | `mehdi123` | — | Super Admin (`/admin/login`) |

### Staff PIN codes

#### cafetunisia
| Name | Role | PIN |
|------|------|-----|
| Ahmed | Waiter | `1234` |
| Fatma | Kitchen | `2222` |
| Omar | Cashier | `3333` |

#### restauranttunisia
| Name | Role | PIN |
|------|------|-----|
| Karim | Waiter | `1234` |
| Sana | Kitchen | `2222` |
| Bilel | Cashier | `3333` |
| Chef Amine | Kitchen | `4444` |

---

## App surfaces

All surfaces are served from the same dev server:

| URL | Surface | Auth |
|-----|---------|------|
| `http://localhost:5173/login` | Manager login | Email + password |
| `http://localhost:5173/manager/cafetunisia/dashboard` | Manager dashboard | Requires login |
| `http://localhost:5173/manager/cafetunisia/setup` | Onboarding wizard | Requires login (shown automatically to new tenants) |
| `http://localhost:5173/menu/cafetunisia?table=<qrToken>` | Customer QR menu | None |
| `http://localhost:5173/kitchen/cafetunisia` | Kitchen display | Staff PIN (role: Kitchen) |
| `http://localhost:5173/cashier/cafetunisia` | Cashier kiosk | Staff PIN (role: Cashier) |
| `http://localhost:5173/waiter/cafetunisia` | Waiter tablet app | Staff PIN (role: Waiter) |
| `http://localhost:5173/takeaway/cafetunisia` | Takeaway board | None |
| `http://localhost:5173/admin` | Super admin panel | Admin login |

> Replace `cafetunisia` with `restauranttunisia` to test the second tenant.
> Get `<qrToken>` from the Spaces page in the manager dashboard (QR button on any table).

---

## Full End-to-End Flow (manual)

Open all surfaces simultaneously in separate browser tabs to observe real-time SignalR updates:

1. **Manager** (`/login`) — log in with `mehdi@cafetunisia.com` / `mehdi123`; go to Spaces, copy a table's QR token.
2. **Customer** (`/menu/cafetunisia?table=<qrToken>`) — browse menu, add items, place order.
3. **Waiter** (`/waiter/cafetunisia`) — notification banner appears; ACK it; advance order.
4. **Kitchen** (`/kitchen/cafetunisia`) — order in Pending column; Commencer → InProgress, then Prêt → Ready.
5. **Cashier** (`/cashier/cafetunisia`) — Sessions tab; close the session; print PDF bill.
6. **Takeaway board** (`/takeaway/cafetunisia`) — place a takeaway order from Cashier and watch it appear live.

---

## Automated Tests

### Backend (xUnit + Testcontainers)

```bash
cd backend
dotnet test
```

### Frontend (Vitest + MSW)

```bash
cd frontend
npm test
```

### E2E Playwright (production)

```bash
cd e2e
npm install
npx playwright install chromium
# Edit .env with credentials (already set for production)
npx playwright test
```

E2E tests run against the production Azure URL by default (`BASE_URL` in `e2e/.env`).
All 83 regression tests (T-01 through T-83) are automated.
E2E tests create their own data prefixed with `E2E` — they never rely on seed data.
Traces on failure are saved in `e2e/test-results/`.

---

## Notes

- **Image uploads** — stored in `backend/TabHub.API/wwwroot/uploads/` locally. Set `AzureBlobStorage:ConnectionString` in `appsettings.Development.json` to test the Azure path.
- **PDF bills** — generated in-process by QuestPDF, no external service.
- **Tenant routing** — uses the `X-Tenant` header sent by the frontend API client. No subdomain setup needed.
- **Seed data** — `scripts/db-init.sql` seeds both tenants with realistic demo data. Safe to re-run (idempotent).
