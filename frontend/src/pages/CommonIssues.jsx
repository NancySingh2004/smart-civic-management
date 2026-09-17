import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout.jsx'
import PriorityBadge from '../components/PriorityBadge.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { analyticsApi } from '../services/api.js'

const STATUS_LABELS = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
}

export default function CommonIssues() {
  const [clusters, setClusters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    analyticsApi
      .getCommonIssues(2)
      .then((res) => mounted && setClusters(res.clusters || []))
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  return (
    <AdminLayout
      title="Common Civic Issues"
      subtitle="Complaints that share a category and location, grouped without deleting or merging any individual report"
    >
      {loading ? (
        <div className="card p-16 text-center text-sm text-civic-muted">Loading clusters…</div>
      ) : error ? (
        <div className="card border-civic-danger/30 p-8 text-center text-sm text-civic-danger">{error}</div>
      ) : clusters.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#616A7A" strokeWidth="1.5">
            <rect x="3" y="3" width="12" height="12" rx="2" /><rect x="9" y="9" width="12" height="12" rx="2" />
          </svg>
          <p className="mt-2 font-serif text-base font-semibold text-civic-ink">No common issues yet</p>
          <p className="text-sm text-civic-muted">
            Clusters appear once 2 or more complaints share the same category and location.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {clusters.map((cluster) => (
            <div key={cluster.cluster_id} className="card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-civic-slate">Common Civic Issue</p>
                  <h3 className="mt-1 font-serif text-lg font-semibold text-civic-ink">{cluster.title}</h3>
                </div>
                <PriorityBadge priority={cluster.highest_priority} />
              </div>

              <p className="mt-3 font-serif text-3xl font-semibold text-civic-navy">
                {cluster.total_reports}
                <span className="ml-1.5 font-sans text-sm font-medium text-civic-muted">
                  citizen report{cluster.total_reports === 1 ? '' : 's'}
                </span>
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-civic-muted">Category</p>
                  <p className="mt-0.5 font-medium text-civic-ink">{cluster.category}</p>
                </div>
                <div>
                  <p className="text-xs text-civic-muted">Location</p>
                  <p className="mt-0.5 font-medium text-civic-ink">{cluster.location}</p>
                </div>
                <div>
                  <p className="text-xs text-civic-muted">Status</p>
                  <p className="mt-0.5"><StatusBadge status={cluster.representative_status} /></p>
                </div>
                <div>
                  <p className="text-xs text-civic-muted">Unresolved</p>
                  <p className="mt-0.5 font-medium text-civic-ink">{cluster.unresolved_reports}</p>
                </div>
              </div>

              <p className="mt-3 text-xs text-civic-muted">
                Department: {cluster.assigned_department || 'Not yet assigned'}
              </p>

              <Link
                to={`/admin/complaints?location=${encodeURIComponent(cluster.location)}&category=${encodeURIComponent(cluster.category)}`}
                className="btn-secondary mt-4 w-full"
              >
                View all {cluster.total_reports} linked complaints →
              </Link>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
