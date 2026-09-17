import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge.jsx'
import PriorityBadge from './PriorityBadge.jsx'
import EscalationBadge from './EscalationBadge.jsx'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ComplaintTable({ complaints, loading }) {
  if (loading) {
    return (
      <div className="card p-10 text-center text-sm text-civic-muted">
        Loading complaints…
      </div>
    )
  }

  if (!complaints || complaints.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 p-12 text-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#616A7A" strokeWidth="1.5">
          <path d="M9 3h6l1 3H8l1-3z" />
          <rect x="5" y="6" width="14" height="15" rx="1.5" />
        </svg>
        <p className="mt-2 font-serif text-base font-semibold text-civic-ink">No complaints found</p>
        <p className="text-sm text-civic-muted">Try adjusting your filters or search terms.</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-civic-border bg-civic-bg/60 text-xs font-semibold uppercase tracking-wide text-civic-muted">
              <th className="px-5 py-3">Complaint ID</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Location</th>
              <th className="px-5 py-3">AI Priority</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c.complaint_id} className="border-b border-civic-border last:border-0 hover:bg-civic-bg/50">
                <td className="px-5 py-3.5 font-medium text-civic-navy">{c.complaint_id}</td>
                <td className="px-5 py-3.5 text-civic-ink">{c.category}</td>
                <td className="px-5 py-3.5 text-civic-muted">{c.location}</td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PriorityBadge priority={c.smart_priority} />
                    <EscalationBadge isEscalated={c.is_escalated} level={c.escalation_level} />
                  </div>
                </td>
                <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-3.5 text-civic-muted">{formatDate(c.created_at)}</td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    to={`/admin/complaints/${c.complaint_id}`}
                    className="text-sm font-semibold text-civic-slate hover:text-civic-navy"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
