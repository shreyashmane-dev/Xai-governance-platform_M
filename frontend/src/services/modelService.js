import api from './apiClient'

export const modelService = {
  list: () => api.get('/models'),
  upload: (formData, onUploadProgress) =>
    api.post('/models/upload', formData, {
      onUploadProgress,
    }),
  resultSummary: (modelId) => api.get(`/models/${modelId}/result-summary`),
  compatibility: (modelId, datasetId) => api.get(`/models/${modelId}/compatibility/${datasetId}`),
  remove: (modelId) => api.delete(`/models/${modelId}`),
}
