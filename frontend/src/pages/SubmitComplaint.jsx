import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import { complaintsApi } from '../services/api.js'

const initialForm = { description: '', location: '' }
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function SubmitComplaint() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate() {
    const next = {}
    if (!form.description.trim()) next.description = 'Please describe the issue.'
    else if (form.description.trim().length < 10) next.description = 'Please provide at least 10 characters.'
    if (!form.location.trim()) next.location = 'Please provide a location.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) {
      setImage(null)
      setImagePreview('')
      return
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrors((er) => ({ ...er, image: 'Please choose a JPEG, PNG, or WEBP image.' }))
      e.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrors((er) => ({ ...er, image: 'Image must be smaller than 5MB.' }))
      e.target.value = ''
      return
    }
    setErrors((er) => ({ ...er, image: undefined }))
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImage(null)
    setImagePreview('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    if (!validate()) return

    setLoading(true)
    try {
      const result = await complaintsApi.create({
        description: form.description.trim(),
        location: form.location.trim(),
        image,
      })
      navigate('/complaint-success', { state: { complaint: result } })
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit complaint. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-civic-bg">
      <Navbar />
      <div className="mx-auto max-w-2xl px-6 py-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-civic-slate">Citizen Portal</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-civic-ink">Report a Civic Issue</h1>
        <p className="mt-2 text-sm text-civic-muted">
          Just describe what's wrong and where — our AI automatically detects the category and
          priority, so you don't have to.
        </p>

        <form onSubmit={handleSubmit} noValidate className="card mt-8 space-y-5 p-6">
          {submitError && (
            <div className="rounded-md border border-civic-danger/30 bg-civic-dangerBg px-4 py-3 text-sm text-civic-danger">
              {submitError}
            </div>
          )}

          <div>
            <label className="label-text">Description</label>
            <textarea
              className="input-field min-h-[110px] resize-y"
              placeholder="e.g. Streetlight near Gate 3 has been off for almost a week, road is pitch dark at night."
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
            {errors.description && <p className="mt-1.5 text-xs text-civic-danger">{errors.description}</p>}
            <p className="mt-1.5 text-xs text-civic-muted">
              ✨ Category and priority are detected automatically from what you write.
            </p>
          </div>

          <div>
            <label className="label-text">Location</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. MG Road, near Gate 3"
              value={form.location}
              onChange={(e) => handleChange('location', e.target.value)}
            />
            {errors.location && <p className="mt-1.5 text-xs text-civic-danger">{errors.location}</p>}
          </div>

          <div>
            <label className="label-text">Photo (optional)</label>
            {!imagePreview ? (
              <label className="mt-1 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-civic-border px-4 py-6 text-sm text-civic-muted transition-colors hover:border-civic-slate">
                <span>📷 Click to add a photo of the issue</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
              </label>
            ) : (
              <div className="mt-1.5 flex items-center gap-3">
                <img src={imagePreview} alt="Complaint preview" className="h-20 w-20 rounded-md border border-civic-border object-cover" />
                <button type="button" onClick={removeImage} className="text-sm font-semibold text-civic-danger">
                  Remove photo
                </button>
              </div>
            )}
            {errors.image && <p className="mt-1.5 text-xs text-civic-danger">{errors.image}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Submitting…' : 'Submit Complaint'}
          </button>
        </form>
      </div>
    </div>
  )
}
