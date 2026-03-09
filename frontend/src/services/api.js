import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

// Attach token to every request
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors globally
api.interceptors.response.use(
  res => res,
  err => {
    const isAuthCheck = err.config?.url?.includes('/api/auth/me')
    const onLogin = window.location.pathname === '/login'

    if (err.response?.status === 401 && !isAuthCheck && !onLogin) {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      window.location.replace('/login')
    }
    return Promise.reject(err)
  }
)

export default api
