param kvName string
param location string
param appServicePrincipalId string

@secure()
param dbConnectionString string

@secure()
param jwtKey string

@secure()
param storageConnectionString string

// Key Vault Secrets User role ID (built-in, read-only access to secrets)
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: kvName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    // RBAC authorization (modern, preferred over access policies)
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enabledForDeployment: false
    enabledForTemplateDeployment: true  // allows Bicep to read secrets in parameter references
  }
}

// Grant App Service managed identity read access to secrets
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appServicePrincipalId, kvSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: appServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource secretDbConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'db-connection-string'
  properties: { value: dbConnectionString }
}

resource secretJwtKey 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'jwt-key'
  properties: { value: jwtKey }
}

resource secretStorageConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'storage-connection-string'
  properties: { value: storageConnectionString }
}

output vaultUri string = keyVault.properties.vaultUri
output name string = keyVault.name
