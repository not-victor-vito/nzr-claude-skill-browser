const { app } = require('@azure/functions')
const { getContainer } = require('../../shared/cosmos')
const { v4: uuidv4 } = require('uuid')

const VALID_CATEGORIES = ['Drafting', 'Analysis', 'Summarising', 'Meetings', 'Email', 'Data']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// GET /api/skills
app.http('GetSkills', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'skills',
  handler: async (request, context) => {
    try {
      const container = getContainer()
      const { resources } = await container.items
        .query({ query: 'SELECT * FROM c ORDER BY c.submitted_at DESC' })
        .fetchAll()
      return json(resources)
    } catch (err) {
      context.error('GetSkills error:', err.message)
      return json({ error: 'Failed to retrieve skills.' }, 500)
    }
  },
})

// POST /api/skills
app.http('PostSkill', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'skills',
  handler: async (request, context) => {
    // Extract submitter identity injected by Easy Auth
    let submittedBy = 'unknown'
    const principalHeader = request.headers.get('x-ms-client-principal')
    if (principalHeader) {
      try {
        const decoded = Buffer.from(principalHeader, 'base64').toString('utf8')
        const principal = JSON.parse(decoded)
        if (principal.userDetails) {
          // SWA format
          submittedBy = principal.userDetails
        } else if (Array.isArray(principal.claims)) {
          // App Service Easy Auth format — use name_typ to find the identity claim
          const nameTyp =
            principal.name_typ ||
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn'
          const identityClaim = principal.claims.find((c) => c.typ === nameTyp)
          const fallbackClaim = principal.claims.find(
            (c) =>
              c.typ === 'preferred_username' ||
              c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress' ||
              c.typ === 'email',
          )
          submittedBy =
            identityClaim?.val || fallbackClaim?.val || principal.userId || 'unknown'
        }
      } catch {
        context.warn('Could not parse x-ms-client-principal')
      }
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Request body must be JSON.' }, 400)
    }

    const { title, category, description, prompt, tags } = body

    if (!title || typeof title !== 'string' || !title.trim())
      return json({ error: 'title is required.' }, 400)
    if (!category || !VALID_CATEGORIES.includes(category))
      return json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}.` }, 400)
    if (!prompt || typeof prompt !== 'string' || !prompt.trim())
      return json({ error: 'prompt is required.' }, 400)
    if (prompt.length > 10000)
      return json({ error: 'prompt must be 10,000 characters or fewer.' }, 400)

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
      return json(resource, 201)
    } catch (err) {
      context.error('PostSkill error:', err.message)
      return json({ error: 'Failed to create skill.' }, 500)
    }
  },
})

// POST /api/skills/{id}/use
app.http('IncrementUseCount', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'skills/{id}/use',
  handler: async (request, context) => {
    const { id } = request.params

    if (!id || !UUID_RE.test(id)) {
      return json({ error: 'Invalid skill id.' }, 400)
    }

    try {
      const container = getContainer()
      let resource
      try {
        const result = await container.item(id, id).read()
        resource = result.resource
      } catch (readErr) {
        if (readErr.code === 404) return json({ error: 'Skill not found.' }, 404)
        throw readErr
      }

      resource.use_count = (resource.use_count || 0) + 1
      await container.items.upsert(resource)

      return new Response(null, { status: 204 })
    } catch (err) {
      context.warn('IncrementUseCount error:', err.message)
      return json({ error: 'Could not increment use count.' }, 500)
    }
  },
})
