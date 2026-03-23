# TabHub

**Stack:** ASP.NET Core 8 Web API (C#) + React 19/Vite/TypeScript SPA + PostgreSQL (schema-per-tenant) + Docker
**Runtime:** Backend on `http://localhost:5195` | Frontend on `http://localhost:5173` | Postgres in Docker (`tabhub_postgres`, port 5432)
**Waiter app:** Responsive web page at `/waiter/:tenant` — lives in `frontend/` alongside kitchen, cashier, and takeaway apps

## Entry points
- Backend: `backend/TabHub.API/Program.cs`
- Frontend: `frontend/src/main.tsx` → `App.tsx` → `router.tsx`
- DB init: `scripts/db-init.sql` (runs on fresh Docker volume; re-apply via `docker exec`)
- Tests (backend): `backend/TabHub.Tests/` — xUnit + Testcontainers
- Tests (frontend): `frontend/src/**/*.test.{ts,tsx}` — Vitest + MSW

For detailed file index: read FILEMAP.md
For local testing instructions (all surfaces + SignalR): read TESTING.md

## Backend patterns (read before touching any backend file)

- **Entity**: `Id`, timestamps (`CreatedAt/UpdatedAt/DeletedAt`), nav props. Soft-delete via `DeletedAt`. Query filters in `AppDbContext`.
- **Translation entity**: composite PK `(parentId, Language enum)`. Upsert pattern in controller (`FindAsync` → add or update).
- **Join table entity**: composite PK, two FK nav props, no extra columns unless needed.
- **Controller**: inherits `TenantControllerBase` (has `[ApiController][Authorize]`). Constructor-injected `AppDbContext`, `AuditService`, `ICurrentActor`. `ToDto()` static method. `Snapshot()` for audit before/after.
- **Public endpoints**: `[AllowAnonymous]` overrides controller-level `[Authorize]`. `TenantAuthorizationFilter` already skips unauthenticated requests.
- **AppDbContext**: add `DbSet<T>` + `modelBuilder.Entity<T>()` config for every new entity. snake_case applied globally via `ApplySnakeCaseConventions`. No schema prefix on tenant tables — `search_path` handles routing.
- **SchemaProvisioner**: add `CREATE TABLE IF NOT EXISTS` for every new tenant table — this DDL runs for new tenants.
- **db-init.sql**: mirror SchemaProvisioner DDL in both `cafetunisia` and `restauranttunisia` sections. Also apply manually to live DB via `docker exec`.
- **Enums**: stored as `string` via `.HasConversion<string>()`. Language enum: `FR, AR, EN`. Always parse with `Enum.TryParse` in controllers.
- **Audit**: call `audit.LogAsync(action, entityType, id, actor, before?, after?)` after every write. Use anonymous `Snapshot()` object.

## Mandatory sync rules
On every feature built or modified:
1. **FILEMAP.md** — add new files, update descriptions of changed files, remove deleted files
2. **PROGRESS.md** — mark completed items ✅, add new items under the relevant sprint, update sprint % and status in the overview table

## Development rules
- **No unit tests.** Do not write or suggest test files for any new code (frontend or backend).
