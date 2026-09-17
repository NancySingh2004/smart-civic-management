import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import PriorityBadge from '../components/PriorityBadge.jsx'
import { complaintsApi, API_BASE_URL } from '../services/api.js'

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-2xl leading-none transition-colors ${n <= value ? 'text-civic-gold' : 'text-civic-border'}`}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function FeedbackForm({ complaintId, onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (rating < 1) {
      setError('Please select a star rating.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const updated = await complaintsApi.submitFeedback(complaintId, { rating, comment: comment.trim() || null })
      onSubmitted(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div>
        <p className="label-text">How satisfied are you with the resolution?</p>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <textarea
        className="input-field min-h-[80px] resize-y"
        placeholder="Optional: tell us more about your experience…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <p className="text-xs text-civic-danger">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? 'Submitting…' : 'Submit Feedback'}
      </button>
    </form>
  )
}

export default function TrackComplaint() {
  const [searchParams] = useSearchParams()
  const [complaintId, setComplaintId] = useState(searchParams.get('id') || '')
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const track = useCallback(async (id) => {
    if (!id.trim()) return
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const data = await complaintsApi.getById(id.trim())
      setComplaint(data)
    } catch (err) {
      setComplaint(null)
      setError(err.message || 'Complaint not found. Please check the ID and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (searchParams.get('id')) track(searchParams.get('id'))
  }, [searchParams, track])

  function handleSubmit(e) {
    e.preventDefault()
    track(complaintId)
  }

  return (
    <div className="min-h-screen bg-civic-bg">
      <Navbar />
      <div className="mx-auto max-w-2xl px-6 py-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-civic-slate">Citizen Portal</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-civic-ink">Track Your Complaint</h1>
        <p className="mt-2 text-sm text-civic-muted">
          Enter the Complaint ID you received when you submitted your report to see its current status.
        </p>

        <form onSubmit={handleSubmit} className="card mt-8 flex gap-3 p-5">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="e.g. CMP-1001"
            value={complaintId}
            onChange={(e) => setComplaintId(e.target.value)}
          />
          <button type="submit" disabled={loading} className="btn-primary shrink-0">
            {loading ? 'Searching…' : 'Track'}
          </button>
        </form>

        {error && (
          <div className="mt-5 rounded-md border border-civic-danger/30 bg-civic-dangerBg px-4 py-3 text-sm text-civic-danger">
            {error}
          </div>
        )}

        {!loading && searched && !error && complaint && (
          <div className="mt-6 space-y-6">
            <div className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-serif text-lg font-semibold text-civic-navy">{complaint.complaint_id}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={complaint.status} />
                  <PriorityBadge priority={complaint.smart_priority} />
                </div>
              </div>
              <h2 className="mt-4 font-serif text-base font-semibold text-civic-ink">{complaint.category}</h2>
              <p className="mt-2 text-sm leading-relaxed text-civic-ink">{complaint.description}</p>

              {complaint.image_url && (
                <img
                  src={`${API_BASE_URL}${complaint.image_url}`}
                  alt="Complaint attachment"
                  className="mt-4 max-h-72 rounded-lg border border-civic-border object-cover"
                />
              )}

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-civic-border pt-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-civic-muted">Location</p>
                  <p className="mt-1 text-sm font-medium text-civic-ink">{complaint.location}</p>
                </div>
                <div>
                  <p className="text-xs text-civic-muted">Assigned Department</p>
                  <p className="mt-1 text-sm font-medium text-civic-ink">{complaint.assigned_department || 'Not yet assigned'}</p>
                </div>
                <div>
                  <p className="text-xs text-civic-muted">Submitted</p>
                  <p className="mt-1 text-sm font-medium text-civic-ink">{formatDateTime(complaint.created_at)}</p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-serif text-base font-semibold text-civic-ink">Status Timeline</h3>
              <ol className="mt-4 space-y-4 border-l-2 border-civic-border pl-4">
                {complaint.status_history?.map((h, idx) => (
                  <li key={idx} className="relative">
                    <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-civic-slate" />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={h.status} />
                      <span className="text-xs text-civic-muted">{formatDateTime(h.changed_at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-civic-ink">{h.note}</p>
                  </li>
                ))}
              </ol>
            </div>

            {complaint.status === 'RESOLVED' && (
              <div className="card p-6">
                <h3 className="font-serif text-base font-semibold text-civic-ink">Your Feedback</h3>
                {complaint.feedback ? (
                  <div className="mt-3">
                    <div className="text-xl text-civic-gold">{'★'.repeat(complaint.feedback.rating)}{'☆'.repeat(5 - complaint.feedback.rating)}</div>
                    {complaint.feedback.comment && (
                      <p className="mt-2 text-sm text-civic-ink">{complaint.feedback.comment}</p>
                    )}
                    <p className="mt-2 text-xs text-civic-muted">Submitted {formatDateTime(complaint.feedback.submitted_at)} — thank you!</p>
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-civic-muted">Your issue has been resolved. Let us know how we did.</p>
                    <FeedbackForm complaintId={complaint.complaint_id} onSubmitted={setComplaint} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
