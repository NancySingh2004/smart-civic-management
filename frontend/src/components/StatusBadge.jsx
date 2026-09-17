const STATUS_STYLES = {
  NEW: 'bg-civic-infoBg text-civic-info',
  ASSIGNED: 'bg-civic-warningBg text-civic-warning',
  IN_PROGRESS: 'bg-[#EFE7F6] text-[#6B3FA0]',
  RESOLVED: 'bg-civic-successBg text-civic-success',
}

const STATUS_LABELS = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
}

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-civic-border text-civic-muted'
  const label = STATUS_LABELS[status] || status

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  )
}
