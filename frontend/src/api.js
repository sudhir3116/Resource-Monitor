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

// Response Interceptor: Handle errors and auto-logout on session expiration
api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const { config, response } = err;
        
        // Handle Session Expiration (401 Unauthorized)
        if (response?.status === 401) {
            // Check if the error is due to a stale token rather than a login attempt
            const isLoginRequest = config.url.includes('/login') || config.url.includes('/auth/login');
            
            if (!isLoginRequest) {
                console.warn("[API] Authorization failed. Clearing local data and redirecting...");
                
                // Clear all stored auth data safely
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                
                // Perform a cleaner redirect to the login page avoiding infinite loops
                const currentPath = window.location.pathname;
                if (!currentPath.includes('/login') && !currentPath.includes('/register') && !currentPath.includes('/forgot')) {
                    window.location.replace('/login');
                }
            }
            return Promise.reject(err);
        }

        // Generic error logging for debugging
        if (import.meta.env.DEV) {
            console.error(`[API ERROR] ${response?.status || 'Network'} - ${config?.url}`, response?.data || err.message);
        }

        // Handle specific network errors / timeouts
        if (err.code === "ECONNABORTED" || err.message === "Network Error") {
            // Limited retry logic for specific idempotent requests (GET)
            if (config?.method === 'get' && (!config.retry || config.retry < 2)) {
                config.retry = (config.retry || 0) + 1;
                console.warn(`[RETRY] Retrying ${config.url} due to network timeout... (${config.retry}/2)`);
                return new Promise(resolve => setTimeout(() => resolve(api(config)), 1500));
            }
        }
        
        return Promise.reject(err);
    }
);

export default api;
