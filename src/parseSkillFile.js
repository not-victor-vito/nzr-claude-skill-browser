import JSZip from 'jszip'

const CONTENT_TYPES = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

function guessContentType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return CONTENT_TYPES[ext] || 'application/octet-stream'
}

const IGNORE = ['desktop.ini', 'thumbs.db', '.ds_store']

/**
 * Parse a .skill file (zip) and return:
 *   { title, description, prompt, assets: [{ name, data: Uint8Array, contentType }] }
 */
export async function parseSkillFile(file) {
  let zip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error('Could not read file — make sure it is a valid .skill file.')
  }

  const entries = Object.values(zip.files)

  // Find SKILL.md
  const skillMdEntry = entries.find(
    (f) => !f.dir && (f.name.endsWith('/SKILL.md') || f.name === 'SKILL.md'),
  )
  if (!skillMdEntry) throw new Error('No SKILL.md found inside this .skill file.')

  const content = await skillMdEntry.async('string')
  const { title, description, prompt } = parseSkillMd(content)

  // Determine the root folder prefix (e.g. "nzr-pptx/")
  const rootPrefix = skillMdEntry.name.includes('/')
    ? skillMdEntry.name.split('/')[0] + '/'
    : ''

  // Extract binary assets (everything except SKILL.md and ignored files)
  const assets = []
  for (const entry of entries) {
    if (entry.dir) continue
    if (entry.name === skillMdEntry.name) continue

    const basename = entry.name.split('/').pop().toLowerCase()
    if (IGNORE.includes(basename)) continue

    // Path relative to skill root (e.g. "assets/fonts/DMSans.ttf")
    const relativePath = rootPrefix ? entry.name.slice(rootPrefix.length) : entry.name
    if (!relativePath) continue

    const data = await entry.async('uint8array')
    const contentType = guessContentType(relativePath)
    assets.push({ name: relativePath, data, contentType })
  }

  return { title, description, prompt, assets }
}

function parseSkillMd(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/)

  if (!fmMatch) {
    return { title: '', description: '', prompt: content.trim() }
  }

  const frontmatter = fmMatch[1]
  const prompt = content.trim()

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
  const title = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : ''

  let description = ''
  const blockMatch = frontmatter.match(/^description:\s*[>|]\s*\r?\n((?:[ \t]+[^\r\n]*\r?\n?)+)/m)
  if (blockMatch) {
    description = blockMatch[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ')
      .trim()
  } else {
    const inlineMatch = frontmatter.match(/^description:\s*(.+)$/m)
    if (inlineMatch) description = inlineMatch[1].trim().replace(/^['"]|['"]$/g, '')
  }

  if (description.length > 200) description = description.slice(0, 197) + '…'

  return { title, description, prompt }
}
