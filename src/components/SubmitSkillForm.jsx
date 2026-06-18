import { useState, useEffect } from 'react'
import styles from './SubmitSkillForm.module.css'

const INITIAL = {
  title: '',
  category: '',
  description: '',
  prompt: '',
  tags: '',
}

export default function SubmitSkillForm({ onClose, onSubmit, submitting, categories }) {
  const [form, setForm] = useState(INITIAL)
  const [error, setError] = useState(null)

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

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.title.trim() || !form.category || !form.prompt.trim()) {
      setError('Title, category, and prompt are required.')
      return
    }
    try {
      await onSubmit({
        title: form.title.trim(),
        category: form.category,
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
            Category *
            <select
              className={styles.select}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              required
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
