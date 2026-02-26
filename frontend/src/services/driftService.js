import api from './apiClient'

export const driftService = {
  run: (baselineId, currentId) => api.post(`/drift/analyze?baseline_dataset_id=${baselineId}&current_dataset_id=${currentId}`),
}
