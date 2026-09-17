import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout.jsx'
import ComplaintTable from '../components/ComplaintTable.jsx'
import { complaintsApi } from '../services/api.js'

const CATEGORIES = ['Pothole', 'Garbage', 'Streetlight', 'Water Supply', 'Other']
const STATUSES = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export default function Complaints() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [priority, setPriority] = useState(searchParams.get('priority') || '')
  const [location, setLocation] = useState(searchParams.get('location') || '')
  const [escalated, setEscalated] = useState(searchParams.get('escalated') || '')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const filters = {}
    if (search) filters.search = search
    if (category) filters.category = category
    if (status) filters.status = status
    if (priority) filters.priority = priority
    if (location) filters.location = location
    if (escalated) filters.escalated = escalated

    complaintsApi
      .list(filters)
      .then((res) => mounted && setComplaints(res))
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false))

    return () => { mounted = false }
  }, [search, category, status, priority, location, escalated])

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  function clearFilters() {
    setSearch('')
    setCategory('')
    setStatus('')
    setPriority('')
    setLocation('')
    setEscalated('')
    setSearchParams({})
  }

  const hasFilters = search || category || status || priority || location || escalated

  return (
    <AdminLayout title="All Complaints" subtitle={`${complaints.length} complaint${complaints.length === 1 ? '' : 's'} matching your filters`}>
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#616A7A" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search by ID, description, or location…"
            className="input-field pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); updateParam('search', e.target.value) }}
          />
        </div>

        <select
          className="input-field w-auto min-w-[150px]"
          value={category}
          onChange={(e) => { setCategory(e.target.value); updateParam('category', e.target.value) }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className="input-field w-auto min-w-[150px]"
          value={status}
          onChange={(e) => { setStatus(e.target.value); updateParam('status', e.target.value) }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>

        <select
          className="input-field w-auto min-w-[150px]"
          value={priority}
          onChange={(e) => { setPriority(e.target.value); updateParam('priority', e.target.value) }}
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          className="input-field w-auto min-w-[160px]"
          value={escalated}
          onChange={(e) => { setEscalated(e.target.value); updateParam('escalated', e.target.value) }}
        >
          <option value="">All (Escalated + Not)</option>
          <option value="true">Escalated Only</option>
          <option value="false">Not Escalated</option>
        </select>

        {location && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-civic-infoBg px-3 py-1.5 text-xs font-semibold text-civic-slate">
            Location: {location}
            <button
              onClick={() => { setLocation(''); updateParam('location', '') }}
              className="text-civic-slate hover:text-civic-navy"
              aria-label="Clear location filter"
            >
              ×
            </button>
          </span>
        )}

        {hasFilters && (
          <button onClick={clearFilters} className="text-sm font-semibold text-civic-slate hover:text-civic-navy">
            Clear filters
          </button>
        )}
      </div>

      {error ? (
        <div className="card border-civic-danger/30 p-6 text-center text-sm text-civic-danger">{error}</div>
      ) : (
        <ComplaintTable complaints={complaints} loading={loading} />
      )}
    </AdminLayout>
  )
}
