import axios from 'axios';

const PRIMARY_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const BACKUP_URL  = process.env.REACT_APP_BACKUP_API_URL;

// Keep track of which URL is currently being used
let currentBaseURL = PRIMARY_URL;
let isUsingBackup = false;

const api = axios.create({
  baseURL        : currentBaseURL,
  timeout        : 5000, // 5-second timeout rule as requested
  headers        : { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// ── Request interceptor — attach JWT & sync current URL ─────────────────────
api.interceptors.request.use(
  (config) => {
    // Sync config with current active URL (in case it switched globally)
    config.baseURL = currentBaseURL;
    
    const token = localStorage.getItem('hr_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle Failover & Auth ──────────────────────────
api.interceptors.response.use(
  (response) => {
    // Log which server handled the request (from custom header)
    const serverId = response.headers['x-server-id'];
    if (serverId) {
      console.debug(`[API] Handled by: ${serverId}`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 1. FAILOVER LOGIC
    // If it's a network error or timeout AND we haven't already retried on backup
    const isNetworkError = !error.response;
    const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');

    if ((isNetworkError || isTimeout) && !originalRequest._retry && BACKUP_URL) {
      originalRequest._retry = true;
      
      // Toggle to backup URL if we are currently on primary
      if (currentBaseURL === PRIMARY_URL) {
        console.warn(`[FAILOVER] Primary server unreachable. Switching to Backup API...`);
        currentBaseURL = BACKUP_URL;
        isUsingBackup = true;
      } else {
        // If backup also fails, maybe try primary again after some logic, 
        // but for now, we just proceed to reject.
      }

      // Update the request with new URL and retry
      originalRequest.baseURL = currentBaseURL;
      return api(originalRequest);
    }

    // 2. AUTHENTICATION LOGIC (401 / 403)
    if (error.response) {
      const { status, data } = error.response;

      if (status === 401) {
        localStorage.removeItem('hr_token');
        localStorage.removeItem('hr_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }

      return Promise.reject({
        message: data?.message || 'An unexpected error occurred.',
        errors : data?.errors  || [],
        status,
        serverId: error.response.headers['x-server-id']
      });
    }

    // 3. FALLBACK ERROR
    return Promise.reject({
      message: isUsingBackup 
        ? 'All servers are currently unreachable. Please try again later.' 
        : 'Network error. Please check your connection.',
      error: error
    });
  }
);

export default api;
