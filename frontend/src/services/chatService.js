import api from './apiClient'

export const chatService = {
  send: (payload) => api.post('/chat', payload),
  assistantChat: (payload) => api.post('/assistant/chat', payload),
  assistantHistory: (modelId, datasetId, limit = 50) =>
    api.get('/assistant/history', { params: { model_id: modelId, dataset_id: datasetId, limit } }),
}
