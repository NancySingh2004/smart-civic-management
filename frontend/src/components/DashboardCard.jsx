export default function DashboardCard({ label, value, accent = 'slate', icon }) {
  const accentClasses = {
    slate: 'text-civic-slate bg-civic-infoBg',
    gold: 'text-civic-warning bg-civic-warningBg',
    success: 'text-civic-success bg-civic-successBg',
    danger: 'text-civic-danger bg-civic-dangerBg',
    navy: 'text-civic-navy bg-civic-border',
  }

  return (
    <div className="card flex items-center justify-between px-5 py-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-civic-muted">{label}</p>
        <p className="mt-1.5 font-serif text-2xl font-semibold text-civic-ink">{value}</p>
      </div>
      {icon && (
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${accentClasses[accent]}`}>
          {icon}
        </div>
      )}
    </div>
  )
}
