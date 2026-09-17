import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import AdminLayout from '../components/AdminLayout.jsx'
import PriorityBadge from '../components/PriorityBadge.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { analyticsApi } from '../services/api.js'

const CATEGORY_COLORS = {
  Pothole: '#2C4A78',
  Garbage: '#C79A3E',
  Streetlight: '#6B3FA0',
  'Water Supply': '#2E7D5B',
  Other: '#B03A2E',
}

const SLA_COLORS = {
  'SLA Met': '#2E7D5B',
  'SLA Breached': '#B03A2E',
  'At Risk': '#B8860B',
  'Within SLA': '#2C4A78',
}

export default function Analytics() {
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
      <AdminLayout title="Analytics" subtitle="Deep-dive into complaint trends and SLA compliance">
        <div className="card p-16 text-center text-sm text-civic-muted">Loading analytics…</div>
      </AdminLayout>
    )
  }

  if (error || !data) {
    return (
      <AdminLayout title="Analytics" subtitle="Deep-dive into complaint trends and SLA compliance">
        <div className="card border-civic-danger/30 p-8 text-center text-sm text-civic-danger">
          {error || 'Unable to load analytics.'}
        </div>
      </AdminLayout>
    )
  }

  const { issue_distribution, aging_complaints, high_priority_locations, sla_performance } = data

  const slaPieData = [
    { name: 'SLA Met', value: sla_performance.sla_met },
    { name: 'SLA Breached', value: sla_performance.sla_breached_resolved + sla_performance.sla_breached_unresolved },
    { name: 'At Risk', value: sla_performance.sla_at_risk },
    { name: 'Within SLA', value: sla_performance.sla_within },
  ].filter((d) => d.value > 0)

  return (
    <AdminLayout title="Analytics" subtitle="Deep-dive into complaint trends and SLA compliance">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-serif text-base font-semibold text-civic-ink">Complaints by Category</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={issue_distribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E5EC" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#616A7A' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#616A7A' }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {issue_distribution.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || '#616A7A'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-serif text-base font-semibold text-civic-ink">SLA Compliance Breakdown</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slaPieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {slaPieData.map((entry) => (
                    <Cell key={entry.name} fill={SLA_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Aging complaints */}
        <div className="card overflow-hidden lg:col-span-3">
          <div className="border-b border-civic-border px-5 py-4">
            <h3 className="font-serif text-base font-semibold text-civic-ink">Aging Complaints</h3>
            <p className="text-xs text-civic-muted">Open complaints sorted by how long they've been waiting</p>
          </div>
          {aging_complaints.length === 0 ? (
            <p className="p-6 text-center text-sm text-civic-muted">No open complaints — everything is resolved.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-civic-border bg-civic-bg/60 text-xs font-semibold uppercase tracking-wide text-civic-muted">
                    <th className="px-5 py-3">Complaint ID</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">Age</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {aging_complaints.map((c) => (
                    <tr
                      key={c.complaint_id}
                      className={`border-b border-civic-border last:border-0 ${c.sla_status === 'SLA Breached' ? 'bg-civic-dangerBg/40' : ''}`}
                    >
                      <td className="px-5 py-3 font-medium text-civic-navy">{c.complaint_id}</td>
                      <td className="px-5 py-3">{c.category}</td>
                      <td className="px-5 py-3 text-civic-muted">{c.location}</td>
                      <td className="px-5 py-3 font-medium text-civic-ink">{c.age_days}d</td>
                      <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-5 py-3"><PriorityBadge priority={c.smart_priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* High priority locations */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-serif text-base font-semibold text-civic-ink">High-Priority Locations</h3>
          <p className="text-xs text-civic-muted">Ranked by HIGH / CRITICAL complaint volume</p>
          <div className="mt-4 space-y-3">
            {high_priority_locations.length === 0 && (
              <p className="text-sm text-civic-muted">No high-priority hotspots right now.</p>
            )}
            {high_priority_locations.map((loc, idx) => (
              <div key={loc.location} className="flex items-center justify-between rounded-lg border border-civic-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-civic-navy text-xs font-semibold text-civic-goldLight">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-civic-ink">{loc.location}</span>
                </div>
                <span className="rounded-full bg-civic-dangerBg px-2.5 py-1 text-xs font-semibold text-civic-danger">
                  {loc.count} complaint{loc.count === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
