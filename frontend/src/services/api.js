import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Normalize backend error messages into a single readable string
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'Something went wrong. Please try again.'
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail
      message = typeof detail === 'string' ? detail : 'Please check the form and try again.'
    } else if (error.message) {
      message = error.message
    }
    return Promise.reject(new Error(message))
  }
)

export const complaintsApi = {
  // Complaints are submitted as multipart/form-data (description, location,
  // and an optional photo) -- there is no category or priority field, both
  // are determined automatically on the backend.
  create: ({ description, location, image }) => {
    const formData = new FormData()
    formData.append('description', description)
    formData.append('location', location)
    if (image) formData.append('image', image)
    return api.post('/complaints', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  list: (filters = {}) =>
    api.get('/complaints', { params: filters }).then((r) => r.data),

  getById: (id) => api.get(`/complaints/${id}`).then((r) => r.data),

  assign: (id, payload) => api.put(`/complaints/${id}/assign`, payload).then((r) => r.data),

  updateStatus: (id, payload) => api.put(`/complaints/${id}/status`, payload).then((r) => r.data),

  addComment: (id, payload) => api.post(`/complaints/${id}/comments`, payload).then((r) => r.data),

  submitFeedback: (id, payload) => api.post(`/complaints/${id}/feedback`, payload).then((r) => r.data),
}

export const analyticsApi = {
  getDashboard: () => api.get('/analytics/dashboard').then((r) => r.data),

  // Feature 1: Common Civic Issue Clustering
  getCommonIssues: (minSize = 2) =>
    api.get('/analytics/common-issues', { params: { min_size: minSize } }).then((r) => r.data),

  // Feature 2: Complaint Heatmap / Location Intelligence
  getHeatmap: (filters = {}) =>
    api.get('/analytics/heatmap', { params: filters }).then((r) => r.data),
}

export default api
