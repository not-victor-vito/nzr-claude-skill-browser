import { useState, useEffect, useRef } from 'react'
import { parseSkillFile } from '../parseSkillFile.js'
import styles from './SubmitSkillForm.module.css'

const INITIAL = {
  title: '',
  category: '',
  description: '',
  prompt: '',
  tags: '',
}

export default function SubmitSkillForm({ onClose, onSubmit, submitting }) {
  const [form, setForm] = useState(INITIAL)
  const [error, setError] = useState(null)
  const [importNotice, setImportNotice] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset so the same file can be re-selected

    setImporting(true)
    setError(null)
    setImportNotice(null)

    try {
      const parsed = await parseSkillFile(file)
      setForm((prev) => ({
        ...prev,
        title: parsed.title || prev.title,
        description: parsed.description || prev.description,
        prompt: parsed.prompt || prev.prompt,
        // leave category and tags for the user to fill in
      }))
      setImportNotice(`Imported from ${file.name} — review the details and submit.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.title.trim() || !form.prompt.trim()) {
      setError('Title and prompt are required.')
      return
    }
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim(),
        prompt: form.prompt.trim(),
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Add skill">
        <div className={styles.header}>
          <h2 className={styles.title}>Add skill</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* .skill file import */}
        <div className={styles.importRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".skill"
            className={styles.fileInputHidden}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className={styles.importBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={importing || submitting}
          >
            {importing ? 'Importing…' : '↑ Import from .skill file'}
          </button>
          <span className={styles.importHint}>or fill in manually below</span>
        </div>

        {importNotice && <div className={styles.notice}>{importNotice}</div>}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <label className={styles.label}>
            Title *
            <input
              className={styles.input}
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Meeting action extractor"
              maxLength={100}
              required
            />
          </label>

          <label className={styles.label}>
            Description
            <input
              className={styles.input}
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="One sentence explaining what this prompt does"
              maxLength={200}
            />
          </label>

          <label className={styles.label}>
            Prompt *
            <textarea
              className={styles.textarea}
              value={form.prompt}
              onChange={(e) => set('prompt', e.target.value)}
              placeholder="Paste your full Claude prompt here…"
              rows={6}
              required
            />
          </label>

          <label className={styles.label}>
            Tags
            <input
              className={styles.input}
              type="text"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="Comma-separated, e.g. Teams, M365, summarise"
            />
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.footer}>
            <button type="button" className={styles.btnCancel} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={styles.btnSubmit} disabled={submitting}>
              {submitting ? 'Adding…' : 'Add skill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
