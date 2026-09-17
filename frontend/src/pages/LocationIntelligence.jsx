import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../components/AdminLayout.jsx'
import { analyticsApi } from '../services/api.js'

const CATEGORIES = ['Pothole', 'Garbage', 'Streetlight', 'Water Supply', 'Other']
const STATUSES = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const RISK_COLORS = {
  high: '#B03A2E',
  medium: '#C79A3E',
  low: '#2E7D5B',
}
const RISK_LABELS = { high: 'High Risk', medium: 'Medium Risk', low: 'Low Risk' }

const MAP_WIDTH = 640
const MAP_HEIGHT = 420
const PADDING = 40

export default function LocationIntelligence() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hovered, setHovered] = useState(null)

  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const filters = {}
    if (category) filters.category = category
    if (priority) filters.priority = priority
    if (status) filters.status = status
    if (dateFrom) filters.date_from = dateFrom
    if (dateTo) filters.date_to = dateTo

    analyticsApi
      .getHeatmap(filters)
      .then((res) => mounted && setData(res))
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false))

    return () => { mounted = false }
  }, [category, priority, status, dateFrom, dateTo])

  const points = data?.points || []
  const fallback = data?.locations_without_coordinates || []

  const projected = useMemo(() => {
    if (points.length === 0) return []
    const lats = points.map((p) => p.latitude)
    const lngs = points.map((p) => p.longitude)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const latRange = maxLat - minLat || 0.01
    const lngRange = maxLng - minLng || 0.01
    const maxCount = Math.max(...points.map((p) => p.total_count), 1)

    return points.map((p) => {
      const x = PADDING + ((p.longitude - minLng) / lngRange) * (MAP_WIDTH - PADDING * 2)
      // Invert y since latitude increases northward but SVG y increases downward
      const y = PADDING + (1 - (p.latitude - minLat) / latRange) * (MAP_HEIGHT - PADDING * 2)
      const radius = 8 + (p.total_count / maxCount) * 22
      return { ...p, x, y, radius }
    })
  }, [points])

  function clearFilters() {
    setCategory(''); setPriority(''); setStatus(''); setDateFrom(''); setDateTo('')
  }
  const hasFilters = category || priority || status || dateFrom || dateTo

  return (
    <AdminLayout
      title="Location Intelligence"
      subtitle="Complaint concentration, hotspots, and risk by location"
    >
      {/* Filters */}
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <select className="input-field w-auto min-w-[150px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input-field w-auto min-w-[150px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input-field w-auto min-w-[150px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" className="input-field w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-xs text-civic-muted">to</span>
          <input type="date" className="input-field w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm font-semibold text-civic-slate hover:text-civic-navy">
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="card p-16 text-center text-sm text-civic-muted">Loading map…</div>
      ) : error ? (
        <div className="card border-civic-danger/30 p-8 text-center text-sm text-civic-danger">{error}</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Custom SVG risk map -- no external map/tile dependency required */}
          <div className="card p-5 lg:col-span-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-civic-ink">Complaint Concentration Map</h3>
              <div className="flex items-center gap-3 text-xs text-civic-muted">
                {Object.entries(RISK_LABELS).map(([key, label]) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS[key] }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {projected.length === 0 ? (
              <p className="mt-8 p-8 text-center text-sm text-civic-muted">
                No complaints with known coordinates match these filters.
              </p>
            ) : (
              <div className="relative mt-4">
                <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="w-full rounded-lg bg-civic-bg">
                  <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} rx="10" fill="#EEF1F6" />
                  {[0.25, 0.5, 0.75].map((f) => (
                    <line key={f} x1={PADDING} x2={MAP_WIDTH - PADDING} y1={PADDING + f * (MAP_HEIGHT - PADDING * 2)} y2={PADDING + f * (MAP_HEIGHT - PADDING * 2)} stroke="#E2E5EC" strokeDasharray="4 4" />
                  ))}
                  {projected.map((p) => (
                    <g key={p.location} onMouseEnter={() => setHovered(p)} onMouseLeave={() => setHovered(null)}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={p.radius}
                        fill={RISK_COLORS[p.risk_level]}
                        fillOpacity="0.75"
                        stroke={RISK_COLORS[p.risk_level]}
                        strokeWidth="1.5"
                      />
                      <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#FFFFFF">
                        {p.total_count}
                      </text>
                    </g>
                  ))}
                </svg>

                {hovered && (
                  <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-civic-border bg-white px-3.5 py-2.5 text-xs shadow-card">
                    <p className="font-semibold text-civic-ink">{hovered.location}</p>
                    <p className="mt-0.5 text-civic-muted">{hovered.total_count} total · {hovered.unresolved_count} unresolved</p>
                    <p className="text-civic-muted">{hovered.high_or_critical_unresolved_count} high/critical open</p>
                    <p className="mt-0.5 font-medium" style={{ color: RISK_COLORS[hovered.risk_level] }}>
                      {RISK_LABELS[hovered.risk_level]}
                    </p>
                  </div>
                )}
              </div>
            )}
            <p className="mt-3 text-xs text-civic-muted">
              Circle size reflects total complaint volume at that location; color reflects how many open HIGH/CRITICAL complaints it has.
            </p>
          </div>

          {/* Ranked hotspot list */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="font-serif text-base font-semibold text-civic-ink">Hotspots</h3>
            <div className="mt-4 max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
              {projected.length === 0 && <p className="text-sm text-civic-muted">No data for these filters.</p>}
              {[...projected].sort((a, b) => b.total_count - a.total_count).map((p) => (
                <div key={p.location} className="flex items-center justify-between rounded-lg border border-civic-border px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS[p.risk_level] }} />
                    <div>
                      <p className="text-sm font-medium text-civic-ink">{p.location}</p>
                      <p className="text-xs text-civic-muted">{p.unresolved_count} unresolved of {p.total_count}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: RISK_COLORS[p.risk_level] }}>
                    {RISK_LABELS[p.risk_level]}
                  </span>
                </div>
              ))}
            </div>

            {fallback.length > 0 && (
              <div className="mt-5 border-t border-civic-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-civic-muted">
                  No coordinates available
                </p>
                <p className="mt-1 text-xs text-civic-muted">
                  These locations aren't mapped yet, but their complaints are still tracked normally.
                </p>
                <div className="mt-2.5 space-y-1.5">
                  {fallback.map((f) => (
                    <div key={f.location} className="flex items-center justify-between text-sm">
                      <span className="text-civic-ink">{f.location}</span>
                      <span className="text-civic-muted">{f.total_count} complaint{f.total_count === 1 ? '' : 's'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
