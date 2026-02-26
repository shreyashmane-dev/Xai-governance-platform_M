import axios from 'axios'
import { auth } from './firebase'

function normalizeApiBaseUrl() {
  const viteEnv =
    (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_API_URL || import.meta.env.NEXT_PUBLIC_API_URL)) || ''
  const nextEnv = (typeof process !== 'undefined' && process?.env?.NEXT_PUBLIC_API_URL) || ''
  const raw = (viteEnv || nextEnv || 'http://localhost:8000').trim().replace(/\/+$/, '')
  return raw.endsWith('/api') ? raw : `${raw}/api`
}

const api = axios.create({
  baseURL: normalizeApiBaseUrl(),
  timeout: 20000,
})

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config || {}
    const shouldRetry = !error.response && request.method === 'get'
    request.__retryCount = request.__retryCount || 0

    if (shouldRetry && request.__retryCount < 2) {
      request.__retryCount += 1
      const backoff = 300 * 2 ** request.__retryCount
      await new Promise((resolve) => setTimeout(resolve, backoff))
      return api(request)
    }

    if (error?.response?.status === 401) {
      window.location.href = '/auth'
    }
    return Promise.reject(error)
  }
)

export default api
