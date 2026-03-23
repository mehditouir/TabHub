// TabHub — Azure infrastructure
// Deploys: App Service B1 + PostgreSQL Flexible B1ms + Static Web Apps + Blob Storage + Key Vault + App Insights
// All resources sized for Azure 12-month free tier.
//
// Deployment order:
//   1. appinsights, storage, staticwebapp, postgres  (no deps)
//   2. appservice                                    (needs appinsights connection string)
//   3. keyvault                                      (needs app service principal ID)
//   4. appsettings                                   (needs both appservice + keyvault)

@description('Short name prefix — used to derive all resource names. Must be globally unique.')
param namePrefix string = 'tabhub'

@description('Azure region for all resources.')
param location string = 'francecentral'

@description('PostgreSQL admin username.')
param dbAdminUser string = 'tabhubadmin'

@description('PostgreSQL admin password. Min 8 chars, upper + lower + number + special.')
@secure()
param dbAdminPassword string

@description('Production JWT signing key. Min 32 chars random string.')
@secure()
param jwtKey string

// ── Derived names (all from namePrefix) ────────────────────────────────────────

var apiName     = 'api-${namePrefix}'
var planName    = 'plan-${namePrefix}'
var swaName     = 'web-${namePrefix}'
var dbName      = 'db-${namePrefix}'
var storageName = '${namePrefix}store'   // max 24 chars, lowercase, no dashes
var kvName      = 'kv-${namePrefix}'
var appiName    = 'appi-${namePrefix}'
var logName     = 'log-${namePrefix}'
var dbDatabase  = 'tabhub'

// ── 1. Application Insights ────────────────────────────────────────────────────

module appInsights 'modules/appinsights.bicep' = {
  name: 'deploy-appinsights'
  params: {
    appiName: appiName
    logName: logName
    location: location
  }
}

// ── 2. Blob Storage ────────────────────────────────────────────────────────────

module storage 'modules/storage.bicep' = {
  name: 'deploy-storage'
  params: {
    storageName: storageName
    location: location
  }
}

// ── 3. Static Web App ──────────────────────────────────────────────────────────

module swa 'modules/staticwebapp.bicep' = {
  name: 'deploy-swa'
  params: {
    swaName: swaName
    location: location
  }
}

// ── 4. PostgreSQL ──────────────────────────────────────────────────────────────

module postgres 'modules/postgres.bicep' = {
  name: 'deploy-postgres'
  params: {
    dbName: dbName
    dbDatabase: dbDatabase
    dbAdminUser: dbAdminUser
    dbAdminPassword: dbAdminPassword
    location: location
  }
}

// ── 5. App Service (creates managed identity) ─────────────────────────────────

module appService 'modules/appservice.bicep' = {
  name: 'deploy-appservice'
  params: {
    apiName: apiName
    planName: planName
    location: location
    appInsightsConnectionString: appInsights.outputs.connectionString
  }
}

// ── 6. Key Vault (needs app service principal ID) ─────────────────────────────

module keyVault 'modules/keyvault.bicep' = {
  name: 'deploy-keyvault'
  params: {
    kvName: kvName
    location: location
    appServicePrincipalId: appService.outputs.principalId
    dbConnectionString: 'Host=${postgres.outputs.fqdn};Database=${dbDatabase};Username=${dbAdminUser};Password=${dbAdminPassword};SSL Mode=Require;Trust Server Certificate=true'
    jwtKey: jwtKey
    storageConnectionString: storage.outputs.connectionString
  }
}

// ── 7. App settings with Key Vault references (deployed last) ─────────────────

module appSettings 'modules/appsettings.bicep' = {
  name: 'deploy-appsettings'
  params: {
    apiName: apiName
    kvName: kvName
    appInsightsConnectionString: appInsights.outputs.connectionString
    // CORS: allow both the SWA hostname and localhost for Swagger testing
    corsAllowedOrigins: 'https://${swa.outputs.defaultHostname},http://localhost:5173'
    storageContainerName: 'tabhub-images'
    storageCdnBaseUrl: storage.outputs.blobEndpoint
  }
  dependsOn: [appService, keyVault]
}

// ── Outputs ────────────────────────────────────────────────────────────────────

@description('Backend API URL — set this as VITE_API_URL in GitHub secrets for the frontend build.')
output apiUrl string = 'https://${appService.outputs.defaultHostname}'

@description('Frontend SWA URL')
output swaUrl string = 'https://${swa.outputs.defaultHostname}'

@description('SWA deployment token — add to GitHub secret SWA_DEPLOYMENT_TOKEN after first deploy.')
output swaDeploymentToken string = swa.outputs.deploymentToken

@description('Key Vault name — useful for adding secrets manually if needed.')
output keyVaultName string = kvName
