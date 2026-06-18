const { getContainer } = require('../shared/cosmos')
const { v4: uuidv4 } = require('uuid')

const VALID_CATEGORIES = ['Drafting', 'Analysis', 'Summarising', 'Meetings', 'Email', 'Data']

/**
 * POST /api/skills
 * Creates a new skill. Submitter identity is read from the Entra ID token
 * that SWA injects as the x-ms-client-principal header.
 */
module.exports = async function (context, req) {
  // --- Auth: extract submitter from SWA client principal ---
  let submittedBy = 'unknown'
  const principalHeader = req.headers['x-ms-client-principal']
  if (principalHeader) {
    try {
      const decoded = Buffer.from(principalHeader, 'base64').toString('utf8')
      const principal = JSON.parse(decoded)
      // userDetails is the UPN (email) for AAD provider
      submittedBy = principal.userDetails || principal.userId || 'unknown'
    } catch {
      context.log.warn('Could not parse x-ms-client-principal')
    }
  }

  // --- Validate body ---
  const body = req.body
  if (!body || typeof body !== 'object') {
    return respond(context, 400, { error: 'Request body must be JSON.' })
  }

  const { title, category, description, prompt, tags } = body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return respond(context, 400, { error: 'title is required.' })
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return respond(context, 400, {
      error: `category must be one of: ${VALID_CATEGORIES.join(', ')}.`,
    })
  }
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return respond(context, 400, { error: 'prompt is required.' })
  }
  if (prompt.length > 10000) {
    return respond(context, 400, { error: 'prompt must be 10,000 characters or fewer.' })
  }

  const item = {
    id: uuidv4(),
    title: title.trim().slice(0, 100),
    category,
    description: (description || '').toString().trim().slice(0, 200),
    prompt: prompt.trim(),
    tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10) : [],
    submitted_by: submittedBy,
    submitted_at: new Date().toISOString(),
    use_count: 0,
  }

  try {
    const container = getContainer()
    const { resource } = await container.items.create(item)
    return respond(context, 201, resource)
  } catch (err) {
    context.log.error('PostSkill error:', err.message)
    return respond(context, 500, { error: 'Failed to create skill.' })
  }
}

function respond(context, status, body) {
  context.res = {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
