// Deployed last — sets all app settings including Key Vault references.
// Separated from appservice.bicep to avoid circular dependency
// (appservice → keyvault → appservice).

param apiName string
param kvName string
param appInsightsConnectionString string
param corsAllowedOrigins string
param storageContainerName string
param storageCdnBaseUrl string

// Key Vault reference helper — App Service resolves these at runtime
func kvRef(vaultName string, secretName string) string => '@Microsoft.KeyVault(VaultName=${vaultName};SecretName=${secretName})'

resource appSettingsConfig 'Microsoft.Web/sites/config@2023-01-01' = {
  name: '${apiName}/appsettings'
  properties: {
    ASPNETCORE_ENVIRONMENT:                     'Production'
    APPLICATIONINSIGHTS_CONNECTION_STRING:      appInsightsConnectionString
    ApplicationInsightsAgent_EXTENSION_VERSION: '~3'

    // Secrets — resolved from Key Vault at runtime via managed identity
    'ConnectionStrings__Default':               kvRef(kvName, 'db-connection-string')
    Jwt__Key:                                   kvRef(kvName, 'jwt-key')
    'AzureStorage__ConnectionString':           kvRef(kvName, 'storage-connection-string')

    // Non-secret config
    Jwt__Issuer:                                'tabhub-api'
    Jwt__Audience:                              'tabhub-client'
    Jwt__AccessTokenMinutes:                    '15'
    Jwt__RefreshTokenDays:                      '30'
    'AzureStorage__ContainerName':              storageContainerName
    'AzureStorage__CdnBaseUrl':                 storageCdnBaseUrl
    Cors__AllowedOrigins:                       corsAllowedOrigins
  }
}
