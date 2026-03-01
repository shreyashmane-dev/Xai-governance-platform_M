import api from './apiClient'

export const governanceService = {
  run: (modelId, datasetId, sensitiveColumn) => {
    const trimmed = (sensitiveColumn || '').trim()
    const base = `/governance/analyze?model_id=${modelId}&dataset_id=${datasetId}`
    const withSensitive = trimmed ? `${base}&sensitive_column=${encodeURIComponent(trimmed)}` : base
    return api.post(withSensitive)
  },
  downloadAudit: () => api.get('/governance/audit/download', { responseType: 'blob' }),
}
