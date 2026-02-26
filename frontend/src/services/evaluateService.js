import api from './apiClient'

export const evaluateService = {
  evaluate: (formData) =>
    api.post('/evaluate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  history: (limit = 20) => api.get('/evaluations', { params: { limit } }),
}
