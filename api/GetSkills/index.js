const { getContainer } = require('../shared/cosmos')

/**
 * GET /api/skills
 * Returns all skills ordered by submitted_at desc.
 */
module.exports = async function (context, req) {
  try {
    const container = getContainer()

    const { resources } = await container.items
      .query({
        query: 'SELECT * FROM c ORDER BY c.submitted_at DESC',
      })
      .fetchAll()

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resources),
    }
  } catch (err) {
    context.log.error('GetSkills error:', err.message)
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to retrieve skills.' }),
    }
  }
}
