import { Link, useLocation, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import PriorityBadge from '../components/PriorityBadge.jsx'

export default function ComplaintSuccess() {
  const location = useLocation()
  const complaint = location.state?.complaint

  if (!complaint) {
    return <Navigate to="/submit-complaint" replace />
  }

  return (
    <div className="min-h-screen bg-civic-bg">
      <Navbar />
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-civic-successBg">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2E7D5B" strokeWidth="2">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="mt-5 font-serif text-2xl font-semibold text-civic-ink">Complaint Submitted</h1>
          <p className="mt-2 text-sm text-civic-muted">
            Thank you for reporting this issue. Your complaint has been logged and will be reviewed shortly.
          </p>

          <div className="mt-7 rounded-lg border border-civic-border bg-civic-bg/60 p-5 text-left">
            <div className="flex items-center justify-between border-b border-civic-border pb-3">
              <span className="text-sm text-civic-muted">Complaint ID</span>
              <span className="font-serif text-lg font-semibold text-civic-navy">{complaint.complaint_id}</span>
            </div>
            <div className="flex items-center justify-between border-b border-civic-border py-3">
              <span className="text-sm text-civic-muted">AI-Detected Category</span>
              <span className="text-sm font-medium text-civic-ink">{complaint.category}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-civic-border">
              <span className="text-sm text-civic-muted">Current Status</span>
              <StatusBadge status={complaint.status} />
            </div>
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm text-civic-muted">AI-Analyzed Priority</span>
              <PriorityBadge priority={complaint.smart_priority} />
            </div>
          </div>

          <p className="mt-5 text-xs text-civic-muted">
            Save this ID to track your complaint's progress with the municipal office.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to={`/track-complaint?id=${complaint.complaint_id}`} className="btn-gold">Track This Complaint</Link>
            <Link to="/submit-complaint" className="btn-secondary">Report Another Issue</Link>
            <Link to="/" className="btn-primary">Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
