const LEVEL_LABELS = {
  LEVEL_1: 'Escalated',
  LEVEL_2: 'Critically Escalated',
}

export default function EscalationBadge({ isEscalated, level, size = 'sm' }) {
  if (!isEscalated) return null

  const sizeClass = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  const style = level === 'LEVEL_2'
    ? 'bg-civic-danger text-white'
    : 'bg-civic-dangerBg text-civic-danger'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${style} ${sizeClass}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      {LEVEL_LABELS[level] || 'Escalated'}
    </span>
  )
}
