import { useState, useEffect, useCallback, useRef } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import SkillCard from './components/SkillCard.jsx'
import SkillModal from './components/SkillModal.jsx'
import SubmitSkillForm from './components/SubmitSkillForm.jsx'
import { apiScope } from './authConfig.js'
import styles from './App.module.css'


// In production VITE_API_BASE_URL points to the standalone Functions app.
// In dev, it's unset and Vite proxies /api → localhost:7071.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export default function App() {
  const { instance, accounts } = useMsal()
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  async function getToken() {
    try {
      const result = await instance.acquireTokenSilent({
        scopes: [apiScope],
        account: accounts[0],
      })
      return result.accessToken
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        const result = await instance.acquireTokenPopup({ scopes: [apiScope] })
        return result.accessToken
      }
      throw err
    }
  }

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = await getToken()
      const res = await fetch(`${API_BASE}/skills`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Failed to load skills (${res.status})`)
      const data = await res.json()
      setSkills(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const filteredSkills = skills.filter((s) => {
    const q = searchQuery.toLowerCase()
    return (
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.prompt.toLowerCase().includes(q) ||
      (s.tags || []).some((t) => t.toLowerCase().includes(q))
    )
  })

  const totalSkills = skills.length
  const mostUsed = skills.length
    ? skills.reduce((a, b) => (b.use_count > a.use_count ? b : a), skills[0])
    : null
  const contributors = new Set(skills.map((s) => s.submitted_by).filter(Boolean)).size

  function showToast(message) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 2750)
  }

  async function handleSubmit(formData) {
    setSubmitting(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_BASE}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Submit failed (${res.status})`)
      }
      await fetchSkills()
      setShowSubmitForm(false)
      showToast('✓ Skill added!')
    } catch (err) {
      throw err
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy(skill) {
    await navigator.clipboard.writeText(skill.prompt)
    setSkills((prev) =>
      prev.map((s) => (s.id === skill.id ? { ...s, use_count: (s.use_count || 0) + 1 } : s))
    )
    getToken()
      .then((token) =>
        fetch(`${API_BASE}/skills/${skill.id}/use`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .catch(() => {})
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerTitle}>
            <span className={styles.sparkle}>✦</span>
            <h1>Skill browser</h1>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>⌕</span>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Search skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className={styles.addBtn} onClick={() => setShowSubmitForm(true)}>
              + Add skill
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Skills</div>
            <div className={styles.statValue}>{totalSkills}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Most used</div>
            <div className={styles.statValue}>{mostUsed?.title ?? '—'}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Contributors</div>
            <div className={styles.statValue}>{contributors}</div>
          </div>
        </div>

        {loading && <div className={styles.message}>Loading skills…</div>}
        {error && (
          <div className={styles.error}>
            {error} —{' '}
            <button className={styles.retryBtn} onClick={fetchSkills}>
              retry
            </button>
          </div>
        )}
        {!loading && !error && filteredSkills.length === 0 && (
          <div className={styles.message}>No skills match your search.</div>
        )}
        {!loading && !error && filteredSkills.length > 0 && (
          <div className={styles.grid}>
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                icon={skill.icon || '📝'}
                onPreview={() => setSelectedSkill(skill)}
                onCopy={() => handleCopy(skill)}
              />
            ))}
          </div>
        )}
      </main>

      {selectedSkill && (
        <SkillModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onCopy={() => handleCopy(selectedSkill)}
        />
      )}

      {toast && <div className={styles.toast}>{toast}</div>}

      {showSubmitForm && (
        <SubmitSkillForm
          onClose={() => setShowSubmitForm(false)}
          onSubmit={handleSubmit}
          submitting={submitting}
          getToken={getToken}
          apiBase={API_BASE}
        />
      )}
    </div>
  )
}
