import api from './apiClient'

export const chatService = {
  send: (payload) => api.post('/chat', payload),
}
