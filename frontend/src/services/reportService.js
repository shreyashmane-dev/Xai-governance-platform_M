import api from './apiClient'

export const reportService = {
  list: () => api.get('/reports'),
  generate: (modelId, datasetId) => api.post(`/reports/generate?model_id=${modelId}&dataset_id=${datasetId}`),
}
