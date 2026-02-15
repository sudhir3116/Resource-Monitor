import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  withCredentials: true,
  timeout: 10000, // 10s timeout to prevent hanging
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 1. Check for missing response (Network Error or Timeout)
    if (!error.response) {
      // console.error('Network/Timeout Error:', error);
      return Promise.reject(error);
    }

    // 2. Prevent infinite loops:
    // Only attempt retry if:
    // - Status is 401 (Unauthorized)
    // - Not already a retry attempt
    // - The failed request was NOT to the refresh endpoint itself
    if (
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh token
        await api.post('/api/auth/refresh');

        // If successful, retry original request
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, session is invalid. Trigger logout.
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        return Promise.reject(refreshError);
      }
    }

    // 3. Handle session invalidation (e.g. server restart -> 403 Forbidden)
    if (error.response.status === 403) {
      // If a request is forbidden due to invalid session/token instance
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    return Promise.reject(error);
  }
);

export default api;
