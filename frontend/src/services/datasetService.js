import api from './apiClient'

export const datasetService = {
  list: () => api.get('/datasets'),
  upload: (formData) => api.post('/datasets/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (datasetId) => api.delete(`/datasets/${datasetId}`),
  preview: (datasetId, limit = 10) => api.get(`/datasets/${datasetId}/preview?limit=${limit}`),
  schema: (datasetId) => api.get(`/datasets/${datasetId}/schema`),
}
