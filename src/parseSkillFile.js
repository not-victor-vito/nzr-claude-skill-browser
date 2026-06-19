import JSZip from 'jszip'

/**
 * Parse a .skill file (zip) and extract structured data for the skill browser.
 * Returns { title, description, prompt } pre-populated from SKILL.md frontmatter.
 */
export async function parseSkillFile(file) {
  let zip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error('Could not read file — make sure it is a valid .skill file.')
  }

  // Find SKILL.md anywhere in the zip (typically at <skill-name>/SKILL.md)
  const skillMdEntry = Object.values(zip.files).find(
    (f) => !f.dir && (f.name.endsWith('/SKILL.md') || f.name === 'SKILL.md'),
  )

  if (!skillMdEntry) {
    throw new Error('No SKILL.md found inside this .skill file.')
  }

  const content = await skillMdEntry.async('string')
  return parseSkillMd(content)
}

function parseSkillMd(content) {
  // Split frontmatter from body
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/)

  if (!fmMatch) {
    // No frontmatter — use whole content as prompt
    return { title: '', description: '', prompt: content.trim() }
  }

  const frontmatter = fmMatch[1]
  // Use the full content (including frontmatter) as the prompt so the skill
  // is complete when copied into Cowork / Claude Code.
  const prompt = content.trim()

  // Parse name (single-line value)
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
  const title = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : ''

  // Parse description — handles both inline and YAML block scalar (`>`)
  let description = ''

  // Block scalar: description: >\n  line one\n  line two
  const blockMatch = frontmatter.match(/^description:\s*[>|]\s*\r?\n((?:[ \t]+[^\r\n]*\r?\n?)+)/m)
  if (blockMatch) {
    description = blockMatch[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ')
      .trim()
  } else {
    // Inline: description: Some text here
    const inlineMatch = frontmatter.match(/^description:\s*(.+)$/m)
    if (inlineMatch) {
      description = inlineMatch[1].trim().replace(/^['"]|['"]$/g, '')
    }
  }

  // Truncate to 200 chars (our Cosmos field limit)
  if (description.length > 200) {
    description = description.slice(0, 197) + '…'
  }

  return { title, description, prompt }
}
