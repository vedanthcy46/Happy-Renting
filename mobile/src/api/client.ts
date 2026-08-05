import axios, { InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { appEvents, SESSION_EXPIRED_EVENT } from '../utils/events';

// Lazy accessor to avoid circular dependency: client ← useAuthStore ← syncEngine ← client
const getAuthStore = () => require('../store/useAuthStore').useAuthStore;

const getBaseUrl = () => {
  const configApiUrl = Constants.expoConfig?.extra?.apiUrl;
  let url = configApiUrl || 'https://happy-renting.onrender.com/api';

  if (__DEV__) {
    const useLocal = Constants.expoConfig?.extra?.USE_LOCAL_API === true;
    if (useLocal) {
      const debuggerHost = Constants.expoConfig?.hostUri;
      const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
      url = `http://${localhost}:5000/api`;
    }
  }

  return url;
};

const client = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000, // Increased timeout
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Request interceptor for API calls
client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = getAuthStore().getState().token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
let sessionExpiredEmitted = false;

client.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle unauthorized errors
    // Skip auto-logout for the login endpoint itself
    if (error.response?.status === 401 && !originalRequest.url?.includes('/auth/login') && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!sessionExpiredEmitted) {
        sessionExpiredEmitted = true;
        appEvents.emit(SESSION_EXPIRED_EVENT);
        await getAuthStore().getState().logout();
        // Reset flag after a short delay so it works correctly if user logs in again
        setTimeout(() => { sessionExpiredEmitted = false; }, 2000);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
