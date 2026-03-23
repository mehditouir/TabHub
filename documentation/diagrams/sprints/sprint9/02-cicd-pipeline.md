# Sprint 9 — GitHub Actions CI/CD Pipeline

Three independent workflows, each triggered by path filters on `main`.

```mermaid
flowchart TD
    subgraph Triggers["Push to main"]
        T1["infra/** changed"]
        T2["backend/** changed"]
        T3["frontend/** changed"]
    end

    T1 --> WF_I
    T2 --> WF_B
    T3 --> WF_F

    subgraph WF_I["infra.yml — Deploy Infrastructure"]
        I1["az login\n(AZURE_CREDENTIALS secret)"]
        I2["az group create\nrg-tabhub (if not exists)"]
        I3["az deployment group create\n--template-file infra/main.bicep\n--parameters DB_ADMIN_PASSWORD + JWT_PROD_KEY\n(from GitHub secrets)"]
        I4["Print outputs:\napiUrl, swaUrl, swaDeploymentToken"]
        I1 --> I2 --> I3 --> I4
    end

    subgraph WF_B["backend.yml — Deploy Backend"]
        B1["dotnet restore TabHub.API"]
        B2["dotnet build API + Tests\n--configuration Release"]
        B3["dotnet test TabHub.Tests\n(Testcontainers: real Postgres\nDocker on ubuntu-latest)"]
        B4["dotnet publish\n--output ./publish"]
        B5["az login"]
        B6["azure/webapps-deploy\napp: api-tabhub\npackage: ./publish"]
        B7["curl /health → 200\n(smoke test)"]
        B1 --> B2 --> B3 --> B4 --> B5 --> B6 --> B7
    end

    subgraph WF_F["frontend.yml — Deploy Frontend"]
        F1["npm ci\n(frontend/)"]
        F2["npm test -- --run\n(Vitest)"]
        F3["npm run build\nVITE_API_URL injected\nfrom GitHub secret"]
        F4["azure/static-web-apps-deploy\ntoken: SWA_DEPLOYMENT_TOKEN\napp_location: frontend\noutput_location: dist\nskip_app_build: true"]
        F1 --> F2 --> F3 --> F4
    end

    B7 -->|fail| FAIL["❌ Deploy failed\nGitHub status: failure"]
    B7 -->|pass| OK_B["✅ Backend live\napi-tabhub.azurewebsites.net"]
    F4 --> OK_F["✅ Frontend live\nweb-tabhub.azurestaticapps.net"]

    style OK_B fill:#D5F5E3,stroke:#1E8449
    style OK_F fill:#D5F5E3,stroke:#1E8449
    style FAIL fill:#FADBD8,stroke:#CB4335
```

## GitHub secrets required

| Secret | Used by | Source |
|---|---|---|
| `AZURE_CREDENTIALS` | All 3 workflows | `az ad sp create-for-rbac --sdk-auth` |
| `AZURE_RESOURCE_GROUP` | infra + backend | `rg-tabhub` |
| `AZURE_APP_SERVICE_NAME` | backend | `api-tabhub` |
| `DB_ADMIN_PASSWORD` | infra | Strong password (min 8 chars) |
| `JWT_PROD_KEY` | infra | Random string min 32 chars |
| `SWA_DEPLOYMENT_TOKEN` | frontend | Output of first infra deploy |
| `VITE_API_URL` | frontend | `https://api-tabhub.azurewebsites.net` |
