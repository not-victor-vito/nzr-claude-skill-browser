import { useState, useEffect, useRef } from 'react'
import { parseSkillFile } from '../parseSkillFile.js'
import styles from './SubmitSkillForm.module.css'

const EMOJIS = [
  '📝','✏️','📄','📊','📈','📋','📌','🗂️',
  '💡','🔍','✅','🎯','⚡','🚀','💬','📧',
  '📅','🤝','👥','🏆','🎨','💻','🔧','🌐',
  '📢','🔐','⚙️','🧠','📦','🛠️','🗣️','🧩',
]

const INITIAL = { title: '', icon: '📝', description: '', prompt: '', tags: '' }

function fromInitialValues(v) {
  return {
    title: v.title || '',
    icon: v.icon || '📝',
    description: v.description || '',
    prompt: v.prompt || '',
    tags: (v.tags || []).join(', '),
  }
}

export default function SubmitSkillForm({
  onClose,
  onSubmit,
  submitting,
  getToken,
  apiBase,
  initialValues = null, // present in edit mode
}) {
  const isEdit = Boolean(initialValues)
  const [form, setForm] = useState(() => (initialValues ? fromInitialValues(initialValues) : INITIAL))
  const [error, setError] = useState(null)
  const [importNotice, setImportNotice] = useState(null)
  const [importing, setImporting] = useState(false)
  const [pendingAssets, setPendingAssets] = useState([])
  const [uploading, setUploading] = useState(false)
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
    e.target.value = ''
    setImporting(true)
    setError(null)
    setImportNotice(null)
    setPendingAssets([])
    try {
      const parsed = await parseSkillFile(file)
      setForm((prev) => ({
        ...prev,
        title: parsed.title || prev.title,
        description: parsed.description || prev.description,
        prompt: parsed.prompt || prev.prompt,
      }))
      setPendingAssets(parsed.assets || [])
      const assetCount = parsed.assets?.length || 0
      const assetNote = assetCount > 0 ? ` (${assetCount} asset${assetCount !== 1 ? 's' : ''} will be uploaded)` : ''
      setImportNotice(`Imported from ${file.name}${assetNote} — review the details and submit.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  async function uploadAsset(asset, token) {
    const res = await fetch(`${apiBase}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filename: asset.name, contentType: asset.contentType }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Upload URL request failed (${res.status})`)
    }
    const { sasUrl, readUrl } = await res.json()
    const put = await fetch(sasUrl, {
      method: 'PUT',
      headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': asset.contentType },
      body: asset.data,
    })
    if (!put.ok) throw new Error(`Asset upload failed for ${asset.name} (${put.status})`)
    return { name: asset.name, url: readUrl }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.title.trim() || !form.prompt.trim()) {
      setError('Title and prompt are required.')
      return
    }
    try {
      let uploadedAssets = []
      if (pendingAssets.length > 0) {
        setUploading(true)
        try {
          const token = await getToken()
          const results = await Promise.allSettled(pendingAssets.map((a) => uploadAsset(a, token)))
          const failed = results.filter((r) => r.status === 'rejected')
          if (failed.length > 0) {
            throw new Error(`${failed.length} asset(s) failed to upload: ${failed[0].reason?.message}`)
          }
          uploadedAssets = results.map((r) => r.value)
        } finally {
          setUploading(false)
        }
      }

      const payload = {
        title: form.title.trim(),
        icon: form.icon,
        description: form.description.trim(),
        prompt: form.prompt.trim().slice(0, 20000),
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      }
      // In edit mode, don't overwrite existing assets unless new ones were uploaded
      if (!isEdit || uploadedAssets.length > 0) {
        payload.assets = uploadedAssets
      }

      await onSubmit(payload)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit skill' : 'Add skill'}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? 'Edit skill' : 'Add skill'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* .skill file import — only shown in create mode */}
        {!isEdit && (
          <div className={styles.importRow}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".skill,.zip,application/zip"
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
        )}

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

          <div className={styles.label}>
            Icon
            <div className={styles.emojiGrid}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`${styles.emojiBtn} ${form.icon === e ? styles.emojiBtnActive : ''}`}
                  onClick={() => set('icon', e)}
                  aria-label={e}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.label}>
            Description
            <input
              className={styles.input}
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="One sentence explaining what this prompt does"
              maxLength={500}
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

          {uploading && (
            <div className={styles.uploadStatus}>
              <span className={styles.uploadSpinner} />
              Uploading {pendingAssets.length} asset{pendingAssets.length !== 1 ? 's' : ''}…
            </div>
          )}

          <div className={styles.footer}>
            <button type="button" className={styles.btnCancel} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={styles.btnSubmit} disabled={submitting || uploading || importing}>
              {uploading ? 'Uploading assets…' : submitting ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save changes' : 'Add skill')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
