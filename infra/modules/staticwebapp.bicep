param swaName string
param location string

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: swaName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

output defaultHostname string = staticWebApp.properties.defaultHostname
// Deployment token is used by the GitHub Actions frontend workflow
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
