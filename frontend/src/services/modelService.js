import api from './apiClient'

export const modelService = {
  list: () => api.get('/models'),
  upload: (formData, onUploadProgress) =>
    api.post('/models/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),
  remove: (modelId) => api.delete(`/models/${modelId}`),
}
