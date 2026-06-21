const { app } = require('@azure/functions')
const { getContainer } = require('../../shared/cosmos')
const { v4: uuidv4 } = require('uuid')
const {
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} = require('@azure/storage-blob')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Sanitise a user-supplied blob path: normalise separators, remove traversal segments,
// strip non-safe characters per segment, then truncate.
function sanitiseBlobName(filename) {
  return filename
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .map((seg) => seg.replace(/[^\w.\-\s]/g, '_').trim())
    .filter(Boolean)
    .join('/')
    .slice(0, 300)
}

// GET /api/skills — returns card-level fields only (no prompt) to keep payload small
app.http('GetSkills', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'skills',
  handler: async (request, context) => {
    try {
      const container = getContainer()
      const { resources } = await container.items
        .query({
          query:
            'SELECT c.id, c.title, c.icon, c.description, c.tags, c.assets, ' +
            'c.submitted_by, c.submitted_at, c.use_count FROM c ORDER BY c.submitted_at DESC',
        })
        .fetchAll()
      return json(resources)
    } catch (err) {
      context.error('GetSkills error:', err.message)
      return json({ error: 'Failed to retrieve skills.' }, 500)
    }
  },
})

// GET /api/skills/:id — full record including prompt, fetched on modal open
app.http('GetSkill', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'skills/{id}',
  handler: async (request, context) => {
    const { id } = request.params
    if (!id || !UUID_RE.test(id)) return json({ error: 'Invalid skill id.' }, 400)
    try {
      const container = getContainer()
      const { resource } = await container.item(id, id).read()
      if (!resource) return json({ error: 'Skill not found.' }, 404)
      return json(resource)
    } catch (err) {
      if (err.code === 404) return json({ error: 'Skill not found.' }, 404)
      context.error('GetSkill error:', err.message)
      return json({ error: 'Failed to retrieve skill.' }, 500)
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
          submittedBy = principal.userDetails
        } else if (Array.isArray(principal.claims)) {
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

    const { title, icon, description, prompt, tags, assets } = body

    if (!title || typeof title !== 'string' || !title.trim())
      return json({ error: 'title is required.' }, 400)
    if (!prompt || typeof prompt !== 'string' || !prompt.trim())
      return json({ error: 'prompt is required.' }, 400)
    if (prompt.length > 20000)
      return json({ error: 'prompt must be 20,000 characters or fewer.' }, 400)

    // Only accept asset URLs from our own storage account
    const storageAccount = process.env.STORAGE_ACCOUNT_NAME
    const allowedPrefix = storageAccount
      ? `https://${storageAccount}.blob.core.windows.net/`
      : null

    const item = {
      id: uuidv4(),
      title: title.trim().slice(0, 100),
      icon: typeof icon === 'string' ? icon.trim().slice(0, 8) : '📝',
      description: (description || '').toString().trim().slice(0, 200),
      prompt: prompt.trim(),
      tags: Array.isArray(tags)
        ? tags.map((t) => String(t).trim().slice(0, 50)).filter(Boolean).slice(0, 10)
        : [],
      assets: Array.isArray(assets)
        ? assets
            .filter(
              (a) =>
                a &&
                typeof a.name === 'string' &&
                typeof a.url === 'string' &&
                (!allowedPrefix || a.url.startsWith(allowedPrefix)),
            )
            .slice(0, 50)
        : [],
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

// POST /api/upload-url
// Returns a short-lived write SAS for direct browser upload, and a long-lived read SAS
// stored in Cosmos so downloads work without making the container public.
app.http('GetUploadUrl', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'upload-url',
  handler: async (request, context) => {
    const accountName = process.env.STORAGE_ACCOUNT_NAME
    const accountKey = process.env.STORAGE_ACCOUNT_KEY
    const containerName = process.env.STORAGE_CONTAINER || 'skill-assets'

    if (!accountName || !accountKey) {
      context.error('Storage env vars not configured')
      return json({ error: 'Asset storage is not configured.' }, 503)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Request body must be JSON.' }, 400)
    }

    const { filename, contentType } = body
    if (!filename || typeof filename !== 'string') {
      return json({ error: 'filename is required.' }, 400)
    }

    const safeName = sanitiseBlobName(filename)
    if (!safeName) return json({ error: 'Invalid filename.' }, 400)

    const blobPath = `${uuidv4()}/${safeName}`

    try {
      const credential = new StorageSharedKeyCredential(accountName, accountKey)

      const sasToken = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: blobPath,
          permissions: BlobSASPermissions.parse('cw'),
          startsOn: new Date(),
          expiresOn: new Date(Date.now() + 15 * 60 * 1000),
          contentType: contentType || 'application/octet-stream',
        },
        credential,
      ).toString()

      const readSasToken = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: blobPath,
          permissions: BlobSASPermissions.parse('r'),
          startsOn: new Date(),
          expiresOn: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
        },
        credential,
      ).toString()

      const sasUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobPath}?${sasToken}`
      const readUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobPath}?${readSasToken}`

      return json({ sasUrl, readUrl })
    } catch (err) {
      context.error('GetUploadUrl error:', err.message)
      return json({ error: 'Could not generate upload URL.' }, 500)
    }
  },
})
