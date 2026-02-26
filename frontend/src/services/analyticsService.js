import api from './apiClient'

export const analyticsService = {
  metrics: (modelId, datasetId) => api.post(`/analytics/metrics?model_id=${modelId}&dataset_id=${datasetId}`),
  shap: (modelId, datasetId) => api.post(`/analytics/shap?model_id=${modelId}&dataset_id=${datasetId}`),
  shapLocal: (modelId, datasetId, rowIndex = 0) =>
    api.get(`/analytics/shap/local?model_id=${modelId}&dataset_id=${datasetId}&row_index=${rowIndex}`),
  summary: () => api.get('/analytics/summary'),
}
