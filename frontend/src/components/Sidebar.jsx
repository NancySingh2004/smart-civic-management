import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  {
    to: '/admin',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/admin/complaints',
    label: 'Complaints',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 3h6l1 3H8l1-3z" />
        <rect x="5" y="6" width="14" height="15" rx="1.5" />
        <path d="M9 11h6M9 15h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/admin/analytics',
    label: 'Analytics',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19V9M11 19V4M18 19v-7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/admin/common-issues',
    label: 'Common Issues',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="12" height="12" rx="2" />
        <rect x="9" y="9" width="12" height="12" rx="2" />
      </svg>
    ),
  },
  {
    to: '/admin/location-intelligence',
    label: 'Location Intel',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 21s7-7.5 7-12a7 7 0 10-14 0c0 4.5 7 12 7 12z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const location = useLocation()

  const isActive = (to) => {
    if (to === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(to)
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-civic-border bg-civic-navy">
      <Link to="/" className="flex items-center gap-2.5 px-6 py-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-civic-gold">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7v2h20V7L12 2z" fill="#12213C" />
            <path d="M4 10v9h2v-9H4zm5 0v9h2v-9H9zm5 0v9h2v-9h-2zm5 0v9h2v-9h-2zM2 21h20v2H2v-2z" fill="#12213C" />
          </svg>
        </span>
        <div>
          <p className="font-serif text-base font-semibold text-white">CivicConnect</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Operations Portal</p>
        </div>
      </Link>

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive(item.to)
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 px-6 py-5">
        <p className="text-xs text-white/40">Logged in as</p>
        <p className="text-sm font-medium text-white">Municipal Administrator</p>
      </div>
    </aside>
  )
}
