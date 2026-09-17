import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import SubmitComplaint from './pages/SubmitComplaint.jsx'
import ComplaintSuccess from './pages/ComplaintSuccess.jsx'
import TrackComplaint from './pages/TrackComplaint.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import Complaints from './pages/Complaints.jsx'
import ComplaintDetails from './pages/ComplaintDetails.jsx'
import Analytics from './pages/Analytics.jsx'
import CommonIssues from './pages/CommonIssues.jsx'
import LocationIntelligence from './pages/LocationIntelligence.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/submit-complaint" element={<SubmitComplaint />} />
      <Route path="/complaint-success" element={<ComplaintSuccess />} />
      <Route path="/track-complaint" element={<TrackComplaint />} />

      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/complaints" element={<Complaints />} />
      <Route path="/admin/complaints/:id" element={<ComplaintDetails />} />
      <Route path="/admin/analytics" element={<Analytics />} />
      <Route path="/admin/common-issues" element={<CommonIssues />} />
      <Route path="/admin/location-intelligence" element={<LocationIntelligence />} />

      <Route path="*" element={<Home />} />
    </Routes>
  )
}
