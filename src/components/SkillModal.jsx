import { useEffect, useState } from 'react'
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

export default function SkillModal({ skill, onClose, onCopy }) {
  const [downloaded, setDownloaded] = useState(false)

  // Close on Escape
  useEffect(() => {
    function handler(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function handleDownload() {
    const blob = new Blob([skill.prompt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${skill.title.replace(/\s+/g, '_').toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(true)
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
          <button className={styles.btnDownload} onClick={handleDownload}>
            ↓ Download prompt
          </button>
        </div>

        {downloaded && (
          <div className={styles.instructions}>
            <div className={styles.instructionsTitle}>✓ Downloaded — here's how to use it</div>
            <ol className={styles.steps}>
              <li>
                Open <strong>Claude</strong> at{' '}
                <a href="https://claude.ai" target="_blank" rel="noreferrer">
                  claude.ai
                </a>{' '}
                or in the desktop app
              </li>
              <li>Start a new conversation</li>
              <li>Open the downloaded <code>.txt</code> file, copy the contents</li>
              <li>Paste into the Claude message box and press Enter</li>
            </ol>
            <div className={styles.instructionsTip}>
              Tip: you can also click <strong>Copy</strong> above and paste directly — no download needed.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
