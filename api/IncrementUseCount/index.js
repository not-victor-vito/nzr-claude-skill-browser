const { getContainer } = require('../shared/cosmos')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * POST /api/skills/{id}/use
 * Increments use_count for a skill. Fire-and-forget from the client.
 */
module.exports = async function (context, req) {
  const { id } = req.params

  if (!id || !UUID_RE.test(id)) {
    context.res = { status: 400, body: JSON.stringify({ error: 'Invalid skill id.' }) }
    return
  }

  try {
    const container = getContainer()

    let resource
    try {
      const result = await container.item(id, id).read()
      resource = result.resource
    } catch (readErr) {
      if (readErr.code === 404) {
        context.res = { status: 404, body: JSON.stringify({ error: 'Skill not found.' }) }
        return
      }
      throw readErr
    }

    resource.use_count = (resource.use_count || 0) + 1
    await container.items.upsert(resource)

    context.res = { status: 204, body: '' }
  } catch (err) {
    context.log.warn('IncrementUseCount error (non-critical):', err.message)
    context.res = { status: 500, body: JSON.stringify({ error: 'Could not increment use count.' }) }
  }
}
