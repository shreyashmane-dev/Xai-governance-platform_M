import axios from 'axios'
import { auth } from './firebase'

function resolveEvalBaseUrl() {
  const env = import.meta.env || {}
  const raw = (
    env.VITE_EVAL_API_URL || 
    env.VITE_API_URL || 
    'http://localhost:5000'
  ).trim().replace(/\/+$/, '')
  return raw.endsWith('/api') ? raw : `${raw}/api`
}

const evalApi = axios.create({
  baseURL: resolveEvalBaseUrl(),
  withCredentials: true,
  timeout: 180000,
})

evalApi.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const evaluateService = {
  evaluate: (formData) =>
    evalApi.post('/evaluate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  history: (limit = 20) => evalApi.get('/evaluations', { params: { limit } }),
}
