import { useEffect, useState } from 'react'
import JSZip from 'jszip'
import styles from './SkillModal.module.css'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'skill'
}

export default function SkillModal({ skill, onClose, onCopy }) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  // Close on Escape
  useEffect(() => {
    function handler(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleDownload() {
    setDownloading(true)
    setDownloadError(null)
    try {
      const slug = slugify(skill.title)
      const zip = new JSZip()
      const folder = zip.folder(slug)

      // Add SKILL.md
      folder.file('SKILL.md', skill.prompt)

      // Fetch and add binary assets
      const assets = skill.assets || []
      await Promise.all(
        assets.map(async (asset) => {
          try {
            const res = await fetch(asset.url)
            if (!res.ok) throw new Error(`${res.status}`)
            const data = await res.arrayBuffer()
            folder.file(asset.name, data)
          } catch (err) {
            console.warn(`Skipping asset ${asset.name}: ${err.message}`)
          }
        }),
      )

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slug}.skill`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError('Download failed — please try again.')
      console.error('Download error:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={skill.title}>
        <div className={styles.header}>
          <h2 className={styles.title}>{skill.title}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className={styles.description}>{skill.description}</p>

        {skill.submitted_by && (
          <div className={styles.author}>
            <div className={styles.avatar}>{getInitials(skill.submitted_by)}</div>
            <span className={styles.authorName}>
              {skill.submitted_by.split('@')[0].replace(/\./g, ' ')}
            </span>
            <span className={styles.dot}>·</span>
            <span className={styles.date}>{formatDate(skill.submitted_at)}</span>
          </div>
        )}

        <div className={styles.promptSection}>
          <div className={styles.promptLabel}>
            Prompt
            <button className={styles.copyInline} onClick={onCopy}>
              ⎘ Copy
            </button>
          </div>
          <div className={styles.promptBox}>{skill.prompt}</div>
        </div>

        {skill.tags && skill.tags.length > 0 && (
          <div className={styles.tags}>
            {skill.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <button
            className={styles.btnDownload}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'Preparing…' : '↓ Download as .skill'}
          </button>
          {downloadError && <span className={styles.downloadError}>{downloadError}</span>}
        </div>
      </div>
    </div>
  )
}
