const { CosmosClient } = require('@azure/cosmos')

let _container = null

function getContainer() {
  if (_container) return _container

  const endpoint = process.env.COSMOS_ENDPOINT
  const key = process.env.COSMOS_KEY
  const databaseId = process.env.COSMOS_DATABASE || 'skills-db'
  const containerId = process.env.COSMOS_CONTAINER || 'skills'

  if (!endpoint || !key) {
    throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be set in application settings.')
  }

  const client = new CosmosClient({ endpoint, key })
  _container = client.database(databaseId).container(containerId)
  return _container
}

module.exports = { getContainer }
