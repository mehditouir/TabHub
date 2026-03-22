# TabHub

Multi-tenant SaaS order management platform for restaurants and cafés.
Customers order via QR code, waiters manage tables on tablets, kitchen receives live orders — all connected in real time via SignalR.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 8, EF Core 8, Npgsql |
| Database | PostgreSQL (schema-per-tenant) |
| Real-time | SignalR |
| Web frontend | React 18 + TypeScript + Vite |
| Mobile / tablet | Ionic React + Capacitor (Android APK) |
| Cloud | Azure France Central |
| CI/CD | GitHub Actions |

---

## Prerequisites

| Tool | Version | Download |
|---|---|---|
| .NET SDK | 8.x | https://dotnet.microsoft.com/download/dotnet/8.0 |
| Node.js | 20 LTS | https://nodejs.org |
| PostgreSQL | 15+ | https://www.postgresql.org/download |
| VS Code | latest | https://code.visualstudio.com |

> **Note:** The repo includes a `global.json` that pins .NET 8. If you have .NET 9 installed it will be ignored automatically.

---

## VS Code setup (first time)

### 1. Install recommended extensions

When you open the project in VS Code, a prompt appears:

> *"This workspace has extension recommendations. Would you like to install them?"*

Click **Install All**. This installs:

- **C# Dev Kit** — IntelliSense, go-to-definition, quick fixes (`Ctrl+.`), Solution Explorer
- **C#** — Roslyn language server
- **.NET Runtime** — required by the above
- **NuGet Package Manager GUI** — add/update/remove packages without leaving VS Code
- **Markdown Mermaid** — renders architecture diagrams in markdown preview

If the prompt doesn't appear, run manually:

```
Ctrl+Shift+P → Extensions: Show Recommended Extensions
```

### 2. Trust the HTTPS dev certificate (once per machine)

```bash
dotnet dev-certs https --trust
```

### 3. Start the database

Make sure Docker Desktop is running, then:

```bash
docker compose up -d
```

This starts PostgreSQL 15 on `localhost:5432` and runs `scripts/db-init.sql` on first boot, which:
- Creates the `public.tenants` shared registry table
- Seeds two dev tenants: `cafejasmine` and `restoabc` with their schemas

### 4. Restore NuGet packages

```bash
dotnet restore backend/TabHub.API.csproj
```

---

## Run the API

### With F5 (debugger attached)

1. Open VS Code at the repo root
2. Press `F5`
3. Select **TabHub API (http)**
4. Swagger UI opens at `http://localhost:5195/swagger`

### With hot reload (no debugger)

```
Ctrl+Shift+P → Run Task → watch
```

### From terminal

```bash
dotnet run --project backend/TabHub.API.csproj
```

---

## VS Code keyboard shortcuts (VS → VS Code mapping)

| Action | Visual Studio | VS Code |
|---|---|---|
| Quick fix / refactor | `Alt+Enter` | `Ctrl+.` |
| Go to definition | `F12` | `F12` |
| Go to implementation | `Ctrl+F12` | `Ctrl+F12` |
| Find all references | `Shift+F12` | `Shift+F12` |
| Rename symbol | `F2` | `F2` |
| Build | `Ctrl+Shift+B` | `Ctrl+Shift+B` |
| Open terminal | `` Ctrl+` `` | `` Ctrl+` `` |
| Command palette | `Ctrl+Shift+P` | `Ctrl+Shift+P` |

---

## Testing tenant resolution

With the API running and Docker Postgres up, test with any HTTP client:

```bash
# Known tenant → 200 OK
curl http://localhost:5195/health -H "Host: cafejasmine.localhost"

# Another tenant → 200 OK
curl http://localhost:5195/health -H "Host: restoabc.localhost"

# Unknown tenant → 404
curl http://localhost:5195/health -H "Host: unknown.localhost"
```

Expected response for a healthy tenant:
```json
{
  "status": "healthy",
  "tenant": "cafejasmine",
  "schema": "cafejasmine",
  "timestamp": "2026-03-18T..."
}
```

---

## NuGet packages

Use the GUI: `Ctrl+Shift+P` → **NuGet Package Manager: Open GUI**

Or from terminal:

```bash
# Add a package
dotnet add backend/TabHub.API.csproj package <PackageName>

# Remove a package
dotnet remove backend/TabHub.API.csproj package <PackageName>

# Update all packages
dotnet restore
```

> Packages are sourced from `nuget.org` only (see `nuget.config` at repo root).

---

## Project structure

```
TabHub/
├── backend/              # ASP.NET Core 8 API
├── frontend/             # React + Vite (customer + manager web)
├── mobile/               # Ionic React + Capacitor (waiter/kitchen APK)
├── shared/               # Shared types/contracts
├── documentation/
│   ├── requirements/     # Business & technical spec (.docx)
│   ├── diagrams/         # Mermaid architecture diagrams
│   └── sprint-plan.md    # Sprint 0–10 plan
├── .vscode/              # Workspace settings, launch, tasks, extensions
├── global.json           # Pins .NET 8 SDK
├── nuget.config          # nuget.org only (no corporate feeds)
└── TabHub.sln
```

---

## Diagrams

All architecture, ERD, sequence and flow diagrams are in `documentation/diagrams/`.
Open any `.md` file and press `Ctrl+Shift+V` to preview.
