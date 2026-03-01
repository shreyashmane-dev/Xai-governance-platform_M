import api from './apiClient'

export const searchService = {
  search: (query) => api.get(`/search?q=${encodeURIComponent(query || '')}`),
}
