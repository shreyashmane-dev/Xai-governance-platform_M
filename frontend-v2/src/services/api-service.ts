import axiosInstance from '@/lib/axios';

export const ApiService = {
  // Health Check
  checkHealth: async () => {
    try {
      const response = await axiosInstance.get('/health');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Example: Get Models
  getModels: async () => {
    try {
      const response = await axiosInstance.get('/api/models');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Example: Get Metrics
  getMetrics: async () => {
    try {
      const response = await axiosInstance.get('/api/metrics');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};
