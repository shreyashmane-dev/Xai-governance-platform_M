import api from './apiClient'

export const datasetService = {
  list: () => api.get('/datasets'),
  upload: (formData) => api.post('/datasets/upload', formData),
  remove: (datasetId) => api.delete(`/datasets/${datasetId}`),
  preview: (datasetId, limit = 10) => api.get(`/datasets/${datasetId}/preview`, { params: { limit } }),
  schema: (datasetId) => api.get(`/datasets/${datasetId}/schema`),
}
