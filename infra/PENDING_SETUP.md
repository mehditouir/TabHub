# Sprint 9 — Pending Setup Info

Before the GitHub Actions workflows and Bicep deployment can run,
I need the following from Mehdi. Ask for all of these on next session.

---

## 1. Azure Subscription ID

Run this and paste the output:
```bash
az account show --query "{subscriptionId:id, tenantId:tenantId}" -o json
```

## 2. Name prefix confirmation

Default is `tabhub` — this becomes:
- `api-tabhub.azurewebsites.net` (API)
- `web-tabhub.azurestaticapps.net` (SPA)
- `db-tabhub.postgres.database.azure.com` (DB)
- `kv-tabhub` (Key Vault)
- `tabhubstore` (Storage)

These must be **globally unique** across Azure. If any are taken, pick a different prefix (e.g. `tabhub-med`).

## 3. Region confirmation

Currently set to `francecentral` (Paris) — lowest latency from Tunisia.
Confirm or change.

## 4. Service principal for GitHub Actions

Run this (replace SUBSCRIPTION_ID) and paste the JSON output — it goes into GitHub secret `AZURE_CREDENTIALS`:
```bash
az ad sp create-for-rbac \
  --name "tabhub-github-deploy" \
  --role contributor \
  --scopes /subscriptions/SUBSCRIPTION_ID/resourceGroups/rg-tabhub \
  --sdk-auth
```
> Note: resource group `rg-tabhub` doesn't need to exist yet — the infra workflow creates it.

## 5. PostgreSQL admin password

Choose a strong password: min 8 chars, upper + lower + number + special char.
Example format: `Tabhub@2026!`
→ Goes into GitHub secret `DB_ADMIN_PASSWORD`

## 6. Production JWT signing key

A random string, min 32 chars.
Say "generate one" and I'll provide it, or choose your own.
→ Goes into GitHub secret `JWT_PROD_KEY`

## 7. GitHub repository full name

Format: `username/TabHub` (e.g. `mehdi-xyz/TabHub`)
Needed for the Static Web Apps deployment workflow.

---

## GitHub secrets to create (summary)

Once you have the above, create these secrets in your GitHub repo
(Settings → Secrets and variables → Actions → New repository secret):

| Secret name | Value source |
|---|---|
| `AZURE_CREDENTIALS` | Output of step 4 |
| `AZURE_RESOURCE_GROUP` | `rg-tabhub` |
| `AZURE_APP_SERVICE_NAME` | `api-tabhub` (or your prefix) |
| `DB_ADMIN_PASSWORD` | Step 5 |
| `JWT_PROD_KEY` | Step 6 |
| `SWA_DEPLOYMENT_TOKEN` | Available AFTER first infra deploy (I'll remind you) |
| `VITE_API_URL` | `https://api-tabhub.azurewebsites.net` (or your prefix) |
