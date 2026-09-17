const PRIORITY_STYLES = {
  LOW: 'bg-civic-border text-civic-muted',
  Low: 'bg-civic-border text-civic-muted',
  MEDIUM: 'bg-civic-infoBg text-civic-info',
  Medium: 'bg-civic-infoBg text-civic-info',
  HIGH: 'bg-civic-warningBg text-civic-warning',
  High: 'bg-civic-warningBg text-civic-warning',
  CRITICAL: 'bg-civic-dangerBg text-civic-danger',
}

export default function PriorityBadge({ priority, size = 'sm' }) {
  const style = PRIORITY_STYLES[priority] || 'bg-civic-border text-civic-muted'
  const sizeClass = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${style} ${sizeClass}`}>
      {priority}
    </span>
  )
}
