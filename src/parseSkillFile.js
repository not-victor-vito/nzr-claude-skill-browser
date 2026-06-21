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

// Files to skip regardless of where they appear
const IGNORE = new Set(['desktop.ini', 'thumbs.db', '.ds_store', '.gitkeep'])

function shouldIgnore(name) {
  const base = name.split('/').pop().toLowerCase()
  return IGNORE.has(base) || base.startsWith('.')
}

/**
 * Parse a .skill or .zip file and return:
 *   { title, description, prompt, assets: [{ name, data: Uint8Array, contentType }] }
 *
 * Handles three structures:
 *   A) Direct .skill zip containing SKILL.md (+ optional asset files)
 *   B) Package .zip containing a .skill file (+ optional loose asset files alongside it)
 *   C) Direct .skill zip containing SKILL.md inside one subfolder
 */
export async function parseSkillFile(file) {
  let outerZip
  try {
    outerZip = await JSZip.loadAsync(file)
  } catch {
    throw new Error('Could not read file — make sure it is a .skill or .zip file.')
  }

  const outerEntries = Object.values(outerZip.files)

  // Check if there's a .skill file inside (package zip — case B)
  const innerSkillEntry = outerEntries.find(
    (f) => !f.dir && f.name.split('/').pop().toLowerCase().endsWith('.skill'),
  )

  if (innerSkillEntry) {
    // --- Case B: outer zip is a package containing a .skill + loose assets ---
    const skillData = await innerSkillEntry.async('arraybuffer')
    let innerZip
    try {
      innerZip = await JSZip.loadAsync(skillData)
    } catch {
      throw new Error(`Could not open ${innerSkillEntry.name} — it may be corrupted.`)
    }

    const innerEntries = Object.values(innerZip.files)
    const skillMdEntry = innerEntries.find(
      (f) => !f.dir && f.name.split('/').pop().toLowerCase() === 'skill.md',
    )
    if (!skillMdEntry) {
      throw new Error(`No SKILL.md found inside ${innerSkillEntry.name}.`)
    }

    const content = await skillMdEntry.async('string')
    const { title, description, prompt } = parseSkillMd(content)

    // Assets from inside the .skill zip
    const innerRootPrefix = skillMdEntry.name.includes('/')
      ? skillMdEntry.name.split('/')[0] + '/'
      : ''
    const assets = []

    for (const entry of innerEntries) {
      if (entry.dir || entry.name === skillMdEntry.name) continue
      if (shouldIgnore(entry.name)) continue
      const rel = innerRootPrefix ? entry.name.slice(innerRootPrefix.length) : entry.name
      if (!rel) continue
      const data = await entry.async('uint8array')
      assets.push({ name: rel, data, contentType: guessContentType(rel) })
    }

    // Loose assets from the outer package zip (skip the .skill itself and ignored files)
    const outerRootPrefix = innerSkillEntry.name.includes('/')
      ? innerSkillEntry.name.split('/')[0] + '/'
      : ''

    for (const entry of outerEntries) {
      if (entry.dir) continue
      if (shouldIgnore(entry.name)) continue
      // Skip the .skill file itself
      if (entry.name === innerSkillEntry.name) continue

      const rel = outerRootPrefix ? entry.name.slice(outerRootPrefix.length) : entry.name
      if (!rel) continue
      // Don't duplicate an asset already found inside the .skill
      if (assets.some((a) => a.name === rel)) continue

      const data = await entry.async('uint8array')
      assets.push({ name: rel, data, contentType: guessContentType(rel) })
    }

    return { title, description, prompt, assets }
  }

  // --- Cases A / C: the uploaded file is itself a .skill zip ---
  const skillMdEntry = outerEntries.find(
    (f) => !f.dir && f.name.split('/').pop().toLowerCase() === 'skill.md',
  )
  if (!skillMdEntry) {
    const names = outerEntries.filter((f) => !f.dir).map((f) => f.name).join(', ')
    throw new Error(
      `No SKILL.md found. Contents: ${names || '(empty)'}`,
    )
  }

  const content = await skillMdEntry.async('string')
  const { title, description, prompt } = parseSkillMd(content)

  const rootPrefix = skillMdEntry.name.includes('/')
    ? skillMdEntry.name.split('/')[0] + '/'
    : ''

  const assets = []
  for (const entry of outerEntries) {
    if (entry.dir || entry.name === skillMdEntry.name) continue
    if (shouldIgnore(entry.name)) continue
    const rel = rootPrefix ? entry.name.slice(rootPrefix.length) : entry.name
    if (!rel) continue
    const data = await entry.async('uint8array')
    assets.push({ name: rel, data, contentType: guessContentType(rel) })
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
