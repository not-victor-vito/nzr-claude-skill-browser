import { useEffect } from 'react'
import styles from './HelpModal.module.css'

const SECTIONS = [
  {
    heading: 'Browsing skills',
    body: 'Skills are shown as cards with a name, description, and tags. Use the search bar to filter by any of these. Click “More info” on a card to read the full prompt and see who submitted it.',
  },
  {
    heading: 'Copying a prompt',
    body: 'Click “Copy” on a card or inside the detail view. The full prompt is copied to your clipboard — paste it into Claude in a new conversation to use it. The use count on the card updates each time someone copies.',
  },
  {
    heading: 'Downloading a .skill file',
    body: 'In the detail view, click “↓ Download as .skill”. The file includes the prompt and any associated assets (fonts, templates, images). To install it in the Claude desktop app, go to Settings → Capabilities → Skills and drag the file in.',
  },
  {
    heading: 'Adding a skill',
    body: 'Click “+ Add skill” in the top right. You can import directly from a .skill or .zip file — the form will pre-fill from it — or fill in the fields manually. Title and prompt are required. Tags help others find your skill.',
  },
  {
    heading: 'Editing or deleting your skills',
    body: 'Open the detail view for a skill you submitted. “✎ Edit” and “Delete” buttons appear at the bottom. Only the person who submitted a skill can edit or delete it.',
  },
]

export default function HelpModal({ onClose }) {
  useEffect(() => {
    function handler(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="How to use Skill Browser">
        <div className={styles.header}>
          <h2 className={styles.title}>How to use the Skill Browser</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.sections}>
          {SECTIONS.map((s) => (
            <div key={s.heading} className={styles.section}>
              <h3 className={styles.sectionHeading}>{s.heading}</h3>
              <p className={styles.sectionBody}>{s.body}</p>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerNote}>
            Questions? Reach out to the team managing NZR's AI tooling.
          </span>
          <button className={styles.closeFooterBtn} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}
