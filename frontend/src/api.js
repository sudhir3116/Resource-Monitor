import axios from "axios";

// Determine API Base URL for both development and production
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || "https://resource-monitor.onrender.com";

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // Reduced timeout slightly for better responsiveness
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request Interceptor: Attach JWT token from localStorage for persistence
api.interceptors.request.use((config) => {
    // Priority: Bearer token from localStorage
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token.replace(/^"|"$/g, '')}`; 
    }
    
    // Log API calls for debugging only in dev
    if (import.meta.env.DEV) {
        console.log(`[API CALL] ${config.method.toUpperCase()} ${config.url}`);
    }
    return config;
}, (error) => Promise.reject(error));

// Response Interceptor: Handle errors and auto-logout ONLY on true token invalidation
api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const { config, response } = err;

        // ── 401 Handler: Only logout on TRUE token invalidation ──────────────
        if (response?.status === 401) {
            const isAuthEndpoint = config?.url?.includes('/login') ||
                config?.url?.includes('/register') ||
                config?.url?.includes('/forgot') ||
                config?.url?.includes('/reset');

            if (!isAuthEndpoint) {
                const msg = response?.data?.message || '';

                // The ONLY messages that mean the token itself is dead
                const TOKEN_INVALID_MESSAGES = [
                    'Token invalid',
                    'No token provided',
                    'Token invalid (user logged out)',
                    'Token has been invalidated',
                    'Invalid authentication session',
                    'jwt expired',
                    'invalid signature',
                    'invalid token',
                ];

                const isTokenDead = TOKEN_INVALID_MESSAGES.some(m =>
                    msg.toLowerCase().includes(m.toLowerCase())
                );

                if (isTokenDead) {
                    console.warn('[API] Token genuinely invalid — clearing session and redirecting to login.');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');

                    const currentPath = window.location.pathname;
                    if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
                        window.location.replace('/login');
                    }
                } else {
                    // 401 for permission/role/approval reasons — do NOT logout
                    // Let the component handle it (show an error, restrict UI, etc.)
                    if (import.meta.env.DEV) {
                        console.warn(`[API] 401 on ${config?.url} — reason: "${msg}" — NOT logging out (not a token issue).`);
                    }
                }
            }
            return Promise.reject(err);
        }

        // Generic error logging (dev only)
        if (import.meta.env.DEV) {
            console.error(`[API ERROR] ${response?.status || 'Network'} - ${config?.url}`, response?.data || err.message);
        }

        // ── Network Error / Timeout: Retry logic (handles Render cold start) ─
        const isNetworkError = err.code === 'ECONNABORTED' ||
            err.message === 'Network Error' ||
            err.code === 'ERR_NETWORK';

        if (isNetworkError && config && !config._retryCount) {
            config._retryCount = 0;
        }

        if (isNetworkError && config && (config._retryCount ?? 0) < 2) {
            config._retryCount = (config._retryCount || 0) + 1;
            const delay = config._retryCount * 2000; // 2s, then 4s
            console.warn(`[RETRY] ${config.url} — attempt ${config._retryCount}/2 in ${delay}ms (Render wake-up)`);
            return new Promise(resolve => setTimeout(() => resolve(api(config)), delay));
        }

        return Promise.reject(err);
    }
);

export default api;
