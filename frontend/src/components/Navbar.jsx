import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()

  const linkClass = (path) =>
    `text-sm font-medium transition-colors ${
      location.pathname === path ? 'text-civic-navy' : 'text-civic-muted hover:text-civic-navy'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-civic-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-civic-navy">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7v2h20V7L12 2z" fill="#C79A3E" />
              <path d="M4 10v9h2v-9H4zm5 0v9h2v-9H9zm5 0v9h2v-9h-2zm5 0v9h2v-9h-2zM2 21h20v2H2v-2z" fill="#F5F6F9" />
            </svg>
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight text-civic-navy">
            CivicConnect
          </span>
        </Link>

        <nav className="flex items-center gap-8">
          <Link to="/" className={linkClass('/')}>Home</Link>
          <Link to="/submit-complaint" className={linkClass('/submit-complaint')}>Submit a Complaint</Link>
          <Link to="/track-complaint" className={linkClass('/track-complaint')}>Track Complaint</Link>
          <Link to="/admin" className="btn-secondary !px-4 !py-2 text-sm">
            Admin Portal
          </Link>
        </nav>
      </div>
    </header>
  )
}
