import api from './apiClient'

export const fraudService = {
  getTransactions: (limit = 50) => api.get(`/fraud/transactions?limit=${limit}`),
  submitTransaction: (payload) => api.post('/fraud/transactions', payload),
  getStats: () => api.get('/fraud/stats'),
}
