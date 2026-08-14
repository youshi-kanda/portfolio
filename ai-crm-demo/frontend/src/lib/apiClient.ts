import axios from 'axios'

/**
 * Axios instance for the AI Consult CRM backend API.
 * JWT token is injected via request interceptor from localStorage.
 * TODO (P1-003): Add 401 handler to refresh token or redirect to login.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})

function normalizeTrailingSlash(url: string): string {
  const suffixIndex = url.search(/[?#]/)
  const path = suffixIndex === -1 ? url : url.slice(0, suffixIndex)
  const suffix = suffixIndex === -1 ? '' : url.slice(suffixIndex)

  if (!path || path.endsWith('/')) {
    return url
  }

  return `${path}/${suffix}`
}

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Django requires trailing slashes
    if (config.url) {
      config.url = normalizeTrailingSlash(config.url)
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Do NOT log personal information in error handler.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(`API Error: ${error.response?.status}`)
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default apiClient
