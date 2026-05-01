import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL        : BASE_URL,
  timeout        : 15000,
  headers        : { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// ── Request interceptor — attach JWT ──────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('hr_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle 401 / 403 ───────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Network error
      return Promise.reject({
        message: 'Network error. Please check your connection.',
      });
    }

    const { status, data } = error.response;

    if (status === 401) {
      // Token expired or invalid — clear session
      localStorage.removeItem('hr_token');
      localStorage.removeItem('hr_user');
      // Redirect to login (without importing router here)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // Return structured error so components can use error.message
    return Promise.reject({
      message: data?.message || 'An unexpected error occurred.',
      errors : data?.errors  || [],
      status,
    });
  }
);

export default api;
