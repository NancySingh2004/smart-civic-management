import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import PriorityBadge from '../components/PriorityBadge.jsx'
import EscalationBadge from '../components/EscalationBadge.jsx'
import { complaintsApi, API_BASE_URL } from '../services/api.js'

const DEPARTMENTS = [
  'Road Maintenance Department',
  'Sanitation Department',
  'Electrical Department',
  'Water Supply Department',
]

const VALID_TRANSITIONS = {
  NEW: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: [],
}

const STATUS_LABELS = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function ComplaintDetails() {
  const { id } = useParams()
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedDept, setSelectedDept] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const [commentAuthor, setCommentAuthor] = useState('Admin')
  const [commentMessage, setCommentMessage] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const loadComplaint = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await complaintsApi.getById(id)
      setComplaint(data)
      setSelectedDept(data.assigned_department || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadComplaint()
  }, [loadComplaint])

  function flashSuccess(msg) {
    setActionSuccess(msg)
    setTimeout(() => setActionSuccess(''), 3000)
  }

  async function handleAssign() {
    if (!selectedDept) {
      setActionError('Please select a department to assign.')
      return
    }
    setAssigning(true)
    setActionError('')
    try {
      const updated = await complaintsApi.assign(id, { department: selectedDept, assigned_by: 'Admin' })
      setComplaint((prev) => ({ ...prev, ...updated }))
      flashSuccess('Complaint assigned successfully.')
    } catch (err) {
      setActionError(err.message)
    } finally {
      setAssigning(false)
    }
  }

  async function handleStatusChange(nextStatus) {
    setUpdatingStatus(true)
    setActionError('')
    try {
      const updated = await complaintsApi.updateStatus(id, { status: nextStatus, changed_by: 'Admin' })
      setComplaint((prev) => ({ ...prev, ...updated }))
      flashSuccess(`Status updated to ${STATUS_LABELS[nextStatus]}.`)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleAddComment(e) {
    e.preventDefault()
    if (!commentMessage.trim()) return
    setAddingComment(true)
    setActionError('')
    try {
      const updated = await complaintsApi.addComment(id, { author: commentAuthor || 'Admin', message: commentMessage.trim() })
      setComplaint((prev) => ({ ...prev, ...updated }))
      setCommentMessage('')
      flashSuccess('Comment added.')
    } catch (err) {
      setActionError(err.message)
    } finally {
      setAddingComment(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Complaint Details">
        <div className="card p-16 text-center text-sm text-civic-muted">Loading complaint…</div>
      </AdminLayout>
    )
  }

  if (error || !complaint) {
    return (
      <AdminLayout title="Complaint Details">
        <div className="card border-civic-danger/30 p-8 text-center text-sm text-civic-danger">
          {error || 'Complaint not found.'}
        </div>
        <Link to="/admin/complaints" className="mt-4 inline-block text-sm font-semibold text-civic-slate">← Back to all complaints</Link>
      </AdminLayout>
    )
  }

  const nextStatuses = VALID_TRANSITIONS[complaint.status] || []

  return (
    <AdminLayout
      title={complaint.complaint_id}
      subtitle={complaint.location}
      actions={<Link to="/admin/complaints" className="btn-secondary">← Back to Complaints</Link>}
    >
      {actionSuccess && (
        <div className="mb-5 rounded-md border border-civic-success/30 bg-civic-successBg px-4 py-3 text-sm text-civic-success">
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="mb-5 rounded-md border border-civic-danger/30 bg-civic-dangerBg px-4 py-3 text-sm text-civic-danger">
          {actionError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: main info */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={complaint.status} />
                <PriorityBadge priority={complaint.smart_priority} />
                <EscalationBadge isEscalated={complaint.is_escalated} level={complaint.escalation_level} />
                {complaint.potential_duplicate && (
                  <span className="inline-flex items-center rounded-full bg-civic-warningBg px-2.5 py-1 text-xs font-semibold text-civic-warning">
                    Potential Duplicate
                  </span>
                )}
              </div>
              <span className="text-xs text-civic-muted">Submitted {formatDateTime(complaint.created_at)}</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg font-semibold text-civic-ink">{complaint.category}</h2>
              {complaint.category_source && (
                <span className="inline-flex items-center rounded-full bg-civic-infoBg px-2.5 py-1 text-xs font-semibold text-civic-info">
                  {complaint.category_source === 'ai' ? '✨ AI-detected' : 'Keyword-detected'}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-civic-ink">{complaint.description}</p>

            {complaint.image_url && (
              <img
                src={`${API_BASE_URL}${complaint.image_url}`}
                alt="Complaint attachment"
                className="mt-4 max-h-80 rounded-lg border border-civic-border object-cover"
              />
            )}

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-civic-border pt-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-civic-muted">Location</p>
                <p className="mt-1 text-sm font-medium text-civic-ink">{complaint.location}</p>
              </div>
              <div>
                <p className="text-xs text-civic-muted">Assigned Department</p>
                <p className="mt-1 text-sm font-medium text-civic-ink">{complaint.assigned_department || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-xs text-civic-muted">Age</p>
                <p className="mt-1 text-sm font-medium text-civic-ink">{complaint.age_days} day{complaint.age_days === 1 ? '' : 's'}</p>
              </div>
            </div>

            {complaint.is_escalated && (
              <div className="mt-5 rounded-lg border border-civic-danger/30 bg-civic-dangerBg px-4 py-3">
                <p className="text-sm font-semibold text-civic-danger">🚨 This complaint has been automatically escalated</p>
                <p className="mt-1 text-xs text-civic-danger/90">{complaint.escalation_reason}</p>
                {complaint.escalated_at && (
                  <p className="mt-1 text-xs text-civic-danger/70">Escalated at {formatDateTime(complaint.escalated_at)}</p>
                )}
              </div>
            )}

            {complaint.is_common_issue && (
              <div className="mt-4 rounded-lg border border-civic-border bg-civic-infoBg/50 px-4 py-3">
                <p className="text-sm font-semibold text-civic-slate">📍 Part of a Common Civic Issue</p>
                <p className="mt-1 text-xs text-civic-muted">
                  {complaint.cluster_size} citizen report{complaint.cluster_size === 1 ? '' : 's'} for {complaint.category} at {complaint.location}.
                </p>
                <Link
                  to={`/admin/complaints?location=${encodeURIComponent(complaint.location)}&category=${encodeURIComponent(complaint.category)}`}
                  className="mt-1.5 inline-block text-xs font-semibold text-civic-slate hover:text-civic-navy"
                >
                  View all linked complaints →
                </Link>
              </div>
            )}
          </div>

          {/* Priority breakdown & similar complaints -- Feature 4: Explainable Smart Priority */}
          <div className="card p-6">
            <h3 className="font-serif text-base font-semibold text-civic-ink">Why this priority?</h3>
            <p className="text-xs text-civic-muted">Generated live from the actual smart priority calculation</p>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-civic-border p-4 text-center">
                <p className="font-serif text-2xl font-semibold text-civic-navy">{complaint.priority_score}</p>
                <p className="mt-1 text-xs text-civic-muted">Priority Score</p>
              </div>
              <div className="rounded-lg border border-civic-border p-4 text-center">
                <p className="font-serif text-2xl font-semibold text-civic-navy">{complaint.similar_complaints}</p>
                <p className="mt-1 text-xs text-civic-muted">Similar Complaints</p>
              </div>
              <div className="rounded-lg border border-civic-border p-4 text-center">
                <PriorityBadge priority={complaint.smart_priority} size="md" />
                <p className="mt-2 text-xs text-civic-muted">Smart Priority</p>
              </div>
            </div>

            {complaint.priority_breakdown && (
              <div className="mt-5 rounded-lg border border-civic-border">
                <table className="w-full text-left text-sm">
                  <tbody>
                    <tr className="border-b border-civic-border">
                      <td className="px-4 py-2.5 text-civic-muted">Category Severity</td>
                      <td className="px-4 py-2.5 text-right font-medium text-civic-ink">+{complaint.priority_breakdown.category_score}</td>
                    </tr>
                    <tr className="border-b border-civic-border">
                      <td className="px-4 py-2.5 text-civic-muted">Complaint Age</td>
                      <td className="px-4 py-2.5 text-right font-medium text-civic-ink">+{complaint.priority_breakdown.age_score}</td>
                    </tr>
                    <tr className="border-b border-civic-border">
                      <td className="px-4 py-2.5 text-civic-muted">Similar Complaints</td>
                      <td className="px-4 py-2.5 text-right font-medium text-civic-ink">+{complaint.priority_breakdown.similar_complaints_score}</td>
                    </tr>
                    <tr className="bg-civic-bg/60">
                      <td className="px-4 py-2.5 font-semibold text-civic-ink">Total</td>
                      <td className="px-4 py-2.5 text-right font-serif font-semibold text-civic-navy">{complaint.priority_score}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-4 text-xs leading-relaxed text-civic-muted">
              Score = Category weight + Complaint age + Similar unresolved complaints in the same category and location.
            </p>
          </div>

          {/* Status history */}
          <div className="card p-6">
            <h3 className="font-serif text-base font-semibold text-civic-ink">Status History</h3>
            <ol className="mt-4 space-y-4 border-l-2 border-civic-border pl-4">
              {complaint.status_history?.map((h, idx) => (
                <li key={idx} className="relative">
                  <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-civic-slate" />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={h.status} />
                    <span className="text-xs text-civic-muted">{formatDateTime(h.changed_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-civic-ink">{h.note}</p>
                  <p className="text-xs text-civic-muted">by {h.changed_by}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Comments */}
          <div className="card p-6">
            <h3 className="font-serif text-base font-semibold text-civic-ink">Comments</h3>
            <div className="mt-4 space-y-4">
              {complaint.comments?.length === 0 && (
                <p className="text-sm text-civic-muted">No comments yet.</p>
              )}
              {complaint.comments?.map((c, idx) => (
                <div key={idx} className="rounded-lg border border-civic-border p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-civic-ink">{c.author}</span>
                    <span className="text-xs text-civic-muted">{formatDateTime(c.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-civic-ink">{c.message}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="mt-5 space-y-3 border-t border-civic-border pt-5">
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Author"
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Add a comment…"
                  value={commentMessage}
                  onChange={(e) => setCommentMessage(e.target.value)}
                />
              </div>
              <button type="submit" disabled={addingComment} className="btn-secondary">
                {addingComment ? 'Posting…' : 'Post Comment'}
              </button>
            </form>
          </div>

          {/* Citizen feedback (submitted after resolution) */}
          {complaint.status === 'RESOLVED' && (
            <div className="card p-6">
              <h3 className="font-serif text-base font-semibold text-civic-ink">Citizen Feedback</h3>
              {complaint.feedback ? (
                <div className="mt-3">
                  <span className="text-xl text-civic-gold">
                    {'★'.repeat(complaint.feedback.rating)}{'☆'.repeat(5 - complaint.feedback.rating)}
                  </span>
                  {complaint.feedback.comment && (
                    <p className="mt-2 text-sm text-civic-ink">{complaint.feedback.comment}</p>
                  )}
                  <p className="mt-2 text-xs text-civic-muted">Submitted {formatDateTime(complaint.feedback.submitted_at)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-civic-muted">The citizen has not submitted feedback yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Right column: actions */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-serif text-base font-semibold text-civic-ink">Assign Department</h3>
            <select
              className="input-field mt-3"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              disabled={complaint.status === 'RESOLVED'}
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button
              onClick={handleAssign}
              disabled={assigning || complaint.status === 'RESOLVED'}
              className="btn-primary mt-3 w-full"
            >
              {assigning ? 'Assigning…' : 'Assign Department'}
            </button>
          </div>

          <div className="card p-6">
            <h3 className="font-serif text-base font-semibold text-civic-ink">Update Status</h3>
            <p className="mt-1 text-xs text-civic-muted">Current: {STATUS_LABELS[complaint.status]}</p>
            <div className="mt-3 space-y-2">
              {nextStatuses.length === 0 ? (
                <p className="rounded-md bg-civic-successBg px-3 py-2.5 text-sm text-civic-success">
                  This complaint has been resolved.
                </p>
              ) : (
                nextStatuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={updatingStatus}
                    className="btn-gold w-full"
                  >
                    Move to {STATUS_LABELS[s]}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-serif text-base font-semibold text-civic-ink">SLA &amp; Escalation</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-civic-muted">Priority</span>
                <PriorityBadge priority={complaint.smart_priority} />
              </div>
              <div className="flex justify-between">
                <span className="text-civic-muted">Resolved At</span>
                <span className="text-civic-ink">{complaint.resolved_at ? formatDateTime(complaint.resolved_at) : 'Not yet resolved'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-civic-muted">Escalation</span>
                {complaint.is_escalated ? (
                  <EscalationBadge isEscalated level={complaint.escalation_level} />
                ) : (
                  <span className="text-xs font-medium text-civic-success">Not escalated</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
