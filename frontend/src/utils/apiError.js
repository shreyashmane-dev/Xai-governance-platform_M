export function getApiErrorMessage(error) {
  const status = error?.response?.status
  const detail = error?.response?.data?.detail

  if (status) {
    const text = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : error?.response?.statusText || 'Request failed'
    return `HTTP ${status}: ${text}`
  }

  if (error?.request) {
    return 'Network error: backend unreachable or CORS blocked. Ensure API is running at http://127.0.0.1:8000.'
  }

  return error?.message || 'Unexpected error'
}
