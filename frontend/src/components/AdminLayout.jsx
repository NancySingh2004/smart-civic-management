import Sidebar from './Sidebar.jsx'

export default function AdminLayout({ title, subtitle, actions, children }) {
  return (
    <div className="flex min-h-screen bg-civic-bg">
      <Sidebar />
      <div className="flex-1">
        <header className="sticky top-0 z-30 border-b border-civic-border bg-white/95 px-8 py-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-xl font-semibold text-civic-ink">{title}</h1>
              {subtitle && <p className="mt-0.5 text-sm text-civic-muted">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        </header>
        <main className="px-8 py-7">{children}</main>
      </div>
    </div>
  )
}
