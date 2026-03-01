import api from './apiClient'

export const systemService = {
  status: () => api.get('/system/status'),
  reset: () => api.delete('/system/reset'),
  functions: () => api.get('/system/functions'),
  selfTest: () => api.get('/system/self-test'),
  auditLog: (limit = 200, action = '', entityType = '') => {
    const params = new URLSearchParams({ limit: String(limit) })
    const nextAction = action.trim()
    const nextEntity = entityType.trim()
    if (nextAction) params.set('action', nextAction)
    if (nextEntity) params.set('entity_type', nextEntity)
    return api.get(`/system/audit-log?${params.toString()}`)
  },
  storage: () => api.get('/system/storage'),
  resources: () => api.get('/system/resources'),
  deleteStorage: (collection) => api.delete(`/system/storage/${collection}`),
}
