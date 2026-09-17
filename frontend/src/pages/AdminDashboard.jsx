import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import AdminLayout from '../components/AdminLayout.jsx'
import DashboardCard from '../components/DashboardCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import PriorityBadge from '../components/PriorityBadge.jsx'
import { analyticsApi } from '../services/api.js'

const CATEGORY_COLORS = {
  Pothole: '#2C4A78',
  Garbage: '#C79A3E',
  Streetlight: '#6B3FA0',
  'Water Supply': '#2E7D5B',
  Other: '#B03A2E',
}

function Icon({ path }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {path}
    </svg>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    analyticsApi
      .getDashboard()
      .then((res) => mounted && setData(res))
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <AdminLayout title="Dashboard" subtitle="Municipal complaint operations at a glance">
        <div className="card p-16 text-center text-sm text-civic-muted">Loading dashboard…</div>
      </AdminLayout>
    )
  }

  if (error || !data) {
    return (
      <AdminLayout title="Dashboard" subtitle="Municipal complaint operations at a glance">
        <div className="card border-civic-danger/30 p-8 text-center text-sm text-civic-danger">
          {error || 'Unable to load dashboard data.'}
        </div>
      </AdminLayout>
    )
  }

  const { summary, issue_distribution, unresolved_complaints, high_priority_locations, sla_performance } = data

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="Municipal complaint operations at a glance"
      actions={
        <Link to="/admin/complaints" className="btn-primary">View All Complaints</Link>
      }
    >
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
        <DashboardCard label="Total" value={summary.total_complaints} accent="navy" icon={<Icon path={<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>} />} />
        <DashboardCard label="New" value={summary.new_complaints} accent="slate" icon={<Icon path={<circle cx="12" cy="12" r="9" />} />} />
        <DashboardCard label="Assigned" value={summary.assigned_complaints} accent="gold" icon={<Icon path={<path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />} />} />
        <DashboardCard label="In Progress" value={summary.in_progress_complaints} accent="slate" icon={<Icon path={<path d="M12 7v5l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />} />} />
        <DashboardCard label="Resolved" value={summary.resolved_complaints} accent="success" icon={<Icon path={<path d="M5 13l4 4L19 7" />} />} />
        <DashboardCard label="Unresolved" value={summary.unresolved_complaints} accent="gold" icon={<Icon path={<path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />} />} />
        <DashboardCard label="SLA Breached" value={summary.sla_breached} accent="danger" icon={<Icon path={<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>} />} />
        <DashboardCard label="Escalated" value={summary.escalated_complaints} accent="danger" icon={<Icon path={<path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />} />} />
      </div>

      {/* New feature quick-links */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link to="/admin/common-issues" className="card flex items-center gap-4 p-5 transition-colors hover:border-civic-slate">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-civic-infoBg text-civic-slate">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="12" height="12" rx="2" /><rect x="9" y="9" width="12" height="12" rx="2" /></svg>
          </span>
          <div>
            <p className="font-serif text-sm font-semibold text-civic-ink">Common Civic Issues</p>
            <p className="text-xs text-civic-muted">Grouped complaint clusters</p>
          </div>
        </Link>
        <Link to="/admin/location-intelligence" className="card flex items-center gap-4 p-5 transition-colors hover:border-civic-slate">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-civic-warningBg text-civic-warning">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s7-7.5 7-12a7 7 0 10-14 0c0 4.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
          </span>
          <div>
            <p className="font-serif text-sm font-semibold text-civic-ink">Location Intelligence</p>
            <p className="text-xs text-civic-muted">Hotspots &amp; risk map</p>
          </div>
        </Link>
        <Link to="/admin/complaints?escalated=true" className="card flex items-center gap-4 p-5 transition-colors hover:border-civic-slate">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-civic-dangerBg text-civic-danger">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          </span>
          <div>
            <p className="font-serif text-sm font-semibold text-civic-ink">Escalated Complaints</p>
            <p className="text-xs text-civic-muted">{summary.escalated_complaints} needing urgent attention</p>
          </div>
        </Link>
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-serif text-base font-semibold text-civic-ink">Issue Distribution</h3>
          <p className="text-xs text-civic-muted">Complaints by category</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={issue_distribution}
                  dataKey="count"
                  nameKey="category"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {issue_distribution.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || '#616A7A'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5 lg:col-span-3">
          <h3 className="font-serif text-base font-semibold text-civic-ink">High-Priority Locations</h3>
          <p className="text-xs text-civic-muted">Locations with the most HIGH / CRITICAL complaints</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={high_priority_locations} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E5EC" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#616A7A' }} />
                <YAxis type="category" dataKey="location" width={140} tick={{ fontSize: 12, fill: '#1B2130' }} />
                <Tooltip />
                <Bar dataKey="count" fill="#C79A3E" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SLA Performance */}
      <div className="mt-6 card p-5">
        <h3 className="font-serif text-base font-semibold text-civic-ink">SLA Performance</h3>
        <p className="text-xs text-civic-muted">Resolution performance against category-based SLA limits</p>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            ['SLA Met (Resolved)', sla_performance.sla_met, 'success'],
            ['SLA Breached (Resolved)', sla_performance.sla_breached_resolved, 'danger'],
            ['Within SLA (Open)', sla_performance.sla_within, 'slate'],
            ['At Risk (Open)', sla_performance.sla_at_risk, 'gold'],
            ['Breached (Open)', sla_performance.sla_breached_unresolved, 'danger'],
          ].map(([label, value, accent]) => (
            <div key={label} className="rounded-lg border border-civic-border p-4">
              <p className={`font-serif text-2xl font-semibold ${
                accent === 'success' ? 'text-civic-success' : accent === 'danger' ? 'text-civic-danger' : accent === 'gold' ? 'text-civic-warning' : 'text-civic-slate'
              }`}>{value}</p>
              <p className="mt-1 text-xs text-civic-muted">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-civic-muted">
          <span className="font-semibold text-civic-ink">{sla_performance.sla_met_percentage}%</span>
          of resolved complaints met their SLA deadline.
        </div>
      </div>

      {/* Unresolved complaints */}
      <div className="mt-6 card overflow-hidden">
        <div className="flex items-center justify-between border-b border-civic-border px-5 py-4">
          <div>
            <h3 className="font-serif text-base font-semibold text-civic-ink">Unresolved Complaints</h3>
            <p className="text-xs text-civic-muted">Oldest open complaints, sorted by age</p>
          </div>
          <Link to="/admin/complaints?status=NEW" className="text-sm font-semibold text-civic-slate hover:text-civic-navy">
            View all →
          </Link>
        </div>
        {unresolved_complaints.length === 0 ? (
          <p className="p-6 text-center text-sm text-civic-muted">No unresolved complaints. Great work!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-civic-border bg-civic-bg/60 text-xs font-semibold uppercase tracking-wide text-civic-muted">
                  <th className="px-5 py-3">Complaint ID</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Age</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {unresolved_complaints.slice(0, 8).map((c) => (
                  <tr key={c.complaint_id} className="border-b border-civic-border last:border-0 hover:bg-civic-bg/50">
                    <td className="px-5 py-3">
                      <Link to={`/admin/complaints/${c.complaint_id}`} className="font-medium text-civic-navy hover:underline">
                        {c.complaint_id}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{c.category}</td>
                    <td className="px-5 py-3 text-civic-muted">{c.location}</td>
                    <td className="px-5 py-3 text-civic-muted">{c.age_days} days</td>
                    <td className="px-5 py-3"><PriorityBadge priority={c.smart_priority} /></td>
                    <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
