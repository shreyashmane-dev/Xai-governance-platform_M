export function getApiErrorMessage(error) {
  const status = error?.response?.status
  const detail = error?.response?.data?.detail || error?.response?.data?.error

  if (status) {
    const text = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : error?.response?.statusText || 'Request failed'
    return `HTTP ${status}: ${text}`
  }

  if (error?.request) {
    return 'Network error: backend unreachable or CORS blocked. Verify backend URL and CORS settings.'
  }

  return error?.message || 'Unexpected error'
}
