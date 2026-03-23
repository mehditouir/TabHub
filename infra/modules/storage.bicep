param storageName string
param location string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: true   // required for serving menu item images publicly
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource imagesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'tabhub-images'
  properties: {
    publicAccess: 'Blob'   // images are publicly readable by URL
  }
}

var accountKey = storageAccount.listKeys().keys[0].value

output connectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${accountKey};EndpointSuffix=${environment().suffixes.storage}'
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob
