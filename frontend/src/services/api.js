import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  timeout: 10000,
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

    // 1. Network Error or Timeout (No Response from Server)
    if (!error.response) {
      const friendlyError = new Error(
        error.code === 'ECONNABORTED'
          ? 'Request timed out. Please check your connection and try again.'
          : 'Cannot connect to server. Please check your internet connection.'
      );
      friendlyError.originalError = error;
      return Promise.reject(friendlyError);
    }

    // 2. Token Refresh Flow (401 Unauthorized)
    if (
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh') &&
      !originalRequest.url.includes('/auth/login')
    ) {
      originalRequest._retry = true;

      try {
        await api.post('/api/auth/refresh');
        return api(originalRequest);
      } catch (refreshError) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        const friendlyError = new Error('Your session has expired. Please log in again.');
        friendlyError.originalError = refreshError;
        return Promise.reject(friendlyError);
      }
    }

    // 3. Forbidden (403) - Insufficient Permissions
    if (error.response.status === 403) {
      const friendlyError = new Error(
        error.response.data?.message || 'You do not have permission to perform this action.'
      );
      friendlyError.originalError = error;
      return Promise.reject(friendlyError);
    }

    // 4. Not Found (404)
    if (error.response.status === 404) {
      const friendlyError = new Error(
        error.response.data?.message || 'The requested resource was not found.'
      );
      friendlyError.originalError = error;
      return Promise.reject(friendlyError);
    }

    // 5. Validation Error (400)
    if (error.response.status === 400) {
      const friendlyError = new Error(
        error.response.data?.message || 'Invalid request. Please check your input.'
      );
      friendlyError.originalError = error;
      return Promise.reject(friendlyError);
    }

    // 6. Server Error (500+)
    if (error.response.status >= 500) {
      const friendlyError = new Error(
        'A server error occurred. Our team has been notified. Please try again later.'
      );
      friendlyError.originalError = error;
      return Promise.reject(friendlyError);
    }

    // 7. Default: Use server message or generic error
    const friendlyError = new Error(
      error.response.data?.message ||
      error.response.data?.error ||
      `Request failed with status ${error.response.status}`
    );
    friendlyError.originalError = error;
    return Promise.reject(friendlyError);
  }
);

export default api;
