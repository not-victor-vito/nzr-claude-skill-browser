import styles from './SkillCard.module.css'

const ICON_BG = {
  Drafting: '#f0fdf4',
  Analysis: '#eff6ff',
  Summarising: '#f0fdf4',
  Meetings: '#fff7ed',
  Email: '#fdf2f8',
  Data: '#f5f3ff',
}

const ICON_COLOR = {
  Drafting: '#16a34a',
  Analysis: '#2563eb',
  Summarising: '#16a34a',
  Meetings: '#ea580c',
  Email: '#db2777',
  Data: '#7c3aed',
}

export default function SkillCard({ skill, icon, onPreview, onCopy }) {
  const bg = ICON_BG[skill.category] || '#f5f5f4'
  const color = ICON_COLOR[skill.category] || '#44403c'
  const isNew =
    skill.submitted_at &&
    Date.now() - new Date(skill.submitted_at).getTime() < 14 * 24 * 60 * 60 * 1000

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <div className={styles.iconWrap} style={{ background: bg, color }}>
          {icon}
        </div>
        {isNew && <span className={styles.badge}>New</span>}
      </div>

      <h2 className={styles.title}>{skill.title}</h2>
      <p className={styles.description}>{skill.description}</p>

      <div className={styles.meta}>
        <span className={styles.useCount}>
          <span className={styles.bolt}>⚡</span>
          {skill.use_count ?? 0}
        </span>
      </div>

      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={onCopy}>
          <span>⎘</span> Copy
        </button>
        <button className={styles.btnSecondary} onClick={onPreview}>
          More info
        </button>
      </div>
    </div>
  )
}
