const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function request(path, options = {}) {
  const token = sessionStorage.getItem('token')
  const headers = options.headers || {}
  if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch (err) {
    // network error (backend down or CORS), surface a friendly message
    console.error('Network error when calling API', err)
    throw new Error('Network error')
  }

  // Global 401 handling
  if (res.status === 401) {
    sessionStorage.removeItem('token')
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    let data
    try {
      data = await res.json()
    } catch (err) {
      console.error('Error parsing JSON response', err)
      throw new Error('Invalid JSON response')
    }
    if (!res.ok) throw new Error(data.message || 'Error')
    return data
  }

  // For non-json responses (CSV export etc.) return raw response
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Error')
  }
  return res
}

export default {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
  raw: (path, options) => request(path, options)
}
