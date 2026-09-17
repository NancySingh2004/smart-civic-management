import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'

const FEATURES = [
  {
    title: 'Smart Prioritization',
    desc: 'A rule-based engine scores every complaint by category, age, and how many similar reports exist nearby — so the most urgent issues surface first.',
    icon: (
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    ),
  },
  {
    title: 'Duplicate Detection',
    desc: 'Complaints sharing a category and location are automatically grouped, helping departments avoid sending crews to the same street twice.',
    icon: (
      <>
        <rect x="3" y="3" width="12" height="12" rx="2" />
        <rect x="9" y="9" width="12" height="12" rx="2" />
      </>
    ),
  },
  {
    title: 'SLA Tracking',
    desc: 'Every priority level carries a resolution deadline. The dashboard flags complaints at risk of breaching SLA before they become a problem.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: 'Full Audit Trail',
    desc: 'Department assignment, status changes, and officer comments are all logged with timestamps, giving a complete history for every complaint.',
    icon: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
  },
]

const STEPS = [
  { n: '1', title: 'Report the issue', desc: 'Citizens describe the problem, add a location and an optional photo — AI detects the category automatically.' },
  { n: '2', title: 'System triages it', desc: 'The complaint receives a unique ID and a smart priority score, then joins the municipal queue instantly.' },
  { n: '3', title: 'Department resolves it', desc: 'Admins assign it to the right department, track progress, and log comments until it is resolved — then the citizen can track it and share feedback.' },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-civic-bg">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-civic-border bg-civic-navy">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-civic-goldLight">
              Municipal Operations, Modernized
            </span>
            <h1 className="mt-5 font-serif text-4xl font-semibold leading-tight text-white md:text-5xl">
              Every pothole, streetlight, and water complaint —
              <span className="text-civic-goldLight"> tracked from report to resolution.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70">
              CivicConnect gives citizens a simple way to report civic issues, and gives municipal
              staff a smart, transparent workflow to assign, prioritize, and resolve them — backed
              by real prioritization logic, not guesswork.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/submit-complaint" className="btn-gold">
                Submit a Complaint
              </Link>
              <Link to="/admin" className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                Go to Admin Portal
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">This Week, City-Wide</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {[
                ['Complaints Filed', '312'],
                ['Avg. Resolution', '2.8 days'],
                ['SLA Met', '91%'],
                ['Departments', '4'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white/5 p-4">
                  <p className="font-serif text-2xl font-semibold text-white">{value}</p>
                  <p className="mt-1 text-xs text-white/50">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-civic-slate">Built for real operations</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-civic-ink">
            A workflow municipal teams can actually run on
          </h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-civic-infoBg text-civic-slate">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  {f.icon}
                </svg>
              </div>
              <h3 className="mt-4 font-serif text-base font-semibold text-civic-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-civic-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-civic-border bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-wide text-civic-slate">How it works</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-civic-ink">From report to resolution in three steps</h2>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, idx) => (
              <div key={s.n} className="relative pl-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-civic-navy font-serif text-sm font-semibold text-civic-goldLight">
                  {s.n}
                </div>
                <h3 className="mt-4 font-serif text-lg font-semibold text-civic-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-civic-muted">{s.desc}</p>
                {idx < STEPS.length - 1 && (
                  <div className="absolute right-[-1rem] top-4 hidden h-px w-8 bg-civic-border md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="font-serif text-2xl font-semibold text-civic-ink">Seen a civic issue near you?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-civic-muted">
          It takes less than a minute to file a report and get a tracking ID.
        </p>
        <Link to="/submit-complaint" className="btn-primary mt-6 inline-flex">
          Submit a Complaint
        </Link>
      </section>

      <footer className="border-t border-civic-border bg-white py-8 text-center text-xs text-civic-muted">
        CivicConnect — Smart Civic Complaint &amp; Issue Management System
      </footer>
    </div>
  )
}
