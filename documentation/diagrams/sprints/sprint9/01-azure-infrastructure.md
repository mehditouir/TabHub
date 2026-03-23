# Sprint 9 — Azure Infrastructure Topology

All resources deployed to **France Central** under `rg-tabhub`.
No custom domain — Azure free subdomains used throughout the demo period.
Path-based tenant routing (`/manager/:tenant/...`, `/waiter/:tenant`, etc.) — no wildcard DNS needed.

```mermaid
flowchart TD
    subgraph Clients["Client Devices"]
        MOB["Customer\n(any browser)"]
        TAB["Waiter / Kitchen / Cashier\n(tablet browser)"]
        MGR["Manager\n(browser)"]
    end

    subgraph Azure["Azure — France Central (rg-tabhub)"]

        subgraph Frontend["Static Web Apps — free tier"]
            SWA["web-tabhub\n*.azurestaticapps.net\nReact SPA (all surfaces)\nSPA fallback: /index.html"]
        end

        subgraph AppSvc["App Service Plan B1 Linux — free 12 mo"]
            APP["api-tabhub\n*.azurewebsites.net\n.NET 8 Web API + SignalR\nalwaysOn: true"]
            MI["System-Assigned\nManaged Identity"]
            APP --- MI
        end

        subgraph PgSvc["PostgreSQL Flexible Server B1ms — free 12 mo"]
            PG["db-tabhub\nPostgreSQL 15\ndatabase: tabhub\nschema-per-tenant"]
        end

        subgraph BlobSvc["Blob Storage — free 5 GB"]
            BLOB["tabhubstore\ncontainer: tabhub-images\nWebP menu photos (public)"]
        end

        subgraph KVSvc["Key Vault (RBAC mode)"]
            KV["kv-tabhub\ndb-connection-string\njwt-key\nstorage-connection-string"]
        end

        subgraph ObsSvc["Application Insights"]
            APPI["appi-tabhub\nLog Analytics workspace\nlive metrics + request traces"]
        end

    end

    subgraph GH["GitHub Actions"]
        WF_I["infra.yml\nBicep deploy"]
        WF_B["backend.yml\nbuild + test + deploy"]
        WF_F["frontend.yml\nnpm build + deploy"]
    end

    MOB  -->|HTTPS| SWA
    TAB  -->|HTTPS + WSS| SWA
    MGR  -->|HTTPS| SWA
    SWA  -->|HTTPS API calls| APP
    SWA  -->|WebSocket SignalR| APP

    APP  -->|SSL| PG
    APP  -->|HTTPS| BLOB
    MI   -->|RBAC Secrets User| KV
    KV   -.->|ref resolution| APP
    APP  -->|telemetry| APPI

    WF_I -->|ARM deployment| Azure
    WF_B -->|zip deploy| APP
    WF_F -->|SWA token| SWA

    style Azure fill:#EBF5FB,stroke:#2E86C1
    style GH fill:#FEF9E7,stroke:#D4AC0D
    style Clients fill:#F9F9F9,stroke:#AAA
```

## Key Vault secrets flow (no credentials in code)

```
App Service managed identity
  → RBAC "Key Vault Secrets User" on kv-tabhub
  → App Settings use Key Vault references (resolved at runtime):
      ConnectionStrings__Default     → db-connection-string
      Jwt__Key                       → jwt-key
      AzureStorage__ConnectionString → storage-connection-string
```

## Resource names (derived from namePrefix = "tabhub")

| Azure resource | Name | Public URL |
|---|---|---|
| App Service | `api-tabhub` | `api-tabhub.azurewebsites.net` |
| Static Web App | `web-tabhub` | `web-tabhub.azurestaticapps.net` |
| PostgreSQL | `db-tabhub` | `db-tabhub.postgres.database.azure.com` |
| Storage | `tabhubstore` | `tabhubstore.blob.core.windows.net` |
| Key Vault | `kv-tabhub` | `kv-tabhub.vault.azure.net` |
| App Insights | `appi-tabhub` | Azure Portal |
