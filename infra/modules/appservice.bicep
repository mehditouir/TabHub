param apiName string
param planName string
param location string
param appInsightsConnectionString string

// App Service Plan — B1 Linux (included in Azure 12-month free tier)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  kind: 'linux'
  properties: {
    reserved: true   // required for Linux
  }
}

// Web App — .NET 8 on Linux with system-assigned managed identity
resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: apiName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|8.0'
      alwaysOn: true           // prevents cold starts
      webSocketsEnabled: true  // required for SignalR
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      // Non-secret app settings only — secrets are added in appsettings.bicep
      // after Key Vault is created (avoids circular dependency)
      appSettings: [
        { name: 'ASPNETCORE_ENVIRONMENT',                    value: 'Production' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING',     value: appInsightsConnectionString }
        { name: 'ApplicationInsightsAgent_EXTENSION_VERSION', value: '~3' }
      ]
    }
  }
}

output principalId string = webApp.identity.principalId
output defaultHostname string = webApp.properties.defaultHostName
output webAppName string = webApp.name
