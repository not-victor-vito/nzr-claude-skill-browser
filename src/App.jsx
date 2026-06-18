import { useState, useEffect, useCallback } from 'react'
import SkillCard from './components/SkillCard.jsx'
import SkillModal from './components/SkillModal.jsx'
import SubmitSkillForm from './components/SubmitSkillForm.jsx'
import styles from './App.module.css'

const CATEGORIES = ['All', 'Drafting', 'Analysis', 'Summarising', 'Meetings', 'Email', 'Data']

const CATEGORY_ICONS = {
  Drafting: '✏️',
  Analysis: '📊',
  Summarising: '📄',
  Meetings: '👥',
  Email: '✉️',
  Data: '🗄️',
}

export default function App() {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/skills')
      if (!res.ok) throw new Error(`Failed to load skills (${res.status})`)
      const data = await res.json()
      setSkills(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const filteredSkills = skills.filter((s) => {
    const matchesCategory = activeCategory === 'All' || s.category === activeCategory
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.prompt.toLowerCase().includes(q) ||
      (s.tags || []).some((t) => t.toLowerCase().includes(q))
    return matchesCategory && matchesSearch
  })

  // Stats
  const totalSkills = skills.length
  const mostUsed = skills.length
    ? skills.reduce((a, b) => (b.use_count > a.use_count ? b : a), skills[0])
    : null
  const contributors = new Set(skills.map((s) => s.submitted_by).filter(Boolean)).size

  async function handleSubmit(formData) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Submit failed (${res.status})`)
      }
      await fetchSkills()
      setShowSubmitForm(false)
    } catch (err) {
      throw err
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy(skill) {
    await navigator.clipboard.writeText(skill.prompt)
    // increment use_count optimistically
    setSkills((prev) =>
      prev.map((s) => (s.id === skill.id ? { ...s, use_count: (s.use_count || 0) + 1 } : s))
    )
    // fire-and-forget to API
    fetch(`/api/skills/${skill.id}/use`, { method: 'POST' }).catch(() => {})
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
        {/* Stats row */}
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

        {/* Category tabs */}
        <div className={styles.tabs}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`${styles.tab} ${activeCategory === cat ? styles.tabActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
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
                icon={CATEGORY_ICONS[skill.category] || '📝'}
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

      {showSubmitForm && (
        <SubmitSkillForm
          onClose={() => setShowSubmitForm(false)}
          onSubmit={handleSubmit}
          submitting={submitting}
          categories={CATEGORIES.filter((c) => c !== 'All')}
        />
      )}
    </div>
  )
}
