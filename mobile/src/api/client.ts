import axios, { InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { appEvents, SESSION_EXPIRED_EVENT } from '../utils/events';

// Lazy accessor to avoid circular dependency: client ← useAuthStore ← syncEngine ← client
const getAuthStore = () => require('../store/useAuthStore').useAuthStore;

const PRIMARY_URL = Constants.expoConfig?.extra?.apiUrl || 'https://happy-renting.onrender.com/api';
const BACKUP_URL = 'https://happy-renting-izbf.onrender.com';

let currentBaseURL = PRIMARY_URL;
let isUsingBackup = false;

const getBaseUrl = () => {
  let url = PRIMARY_URL;

  if (__DEV__) {
    const useLocal = Constants.expoConfig?.extra?.USE_LOCAL_API === true;
    if (useLocal) {
      const debuggerHost = Constants.expoConfig?.hostUri;
      const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
      url = `http://${localhost}:5000/api`;
      currentBaseURL = url;
    }
  }

  return currentBaseURL;
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

    config.baseURL = currentBaseURL;

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

    const isNetworkError = !error.response;
    const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

    if ((isNetworkError || isTimeout) && !originalRequest._retry && BACKUP_URL && currentBaseURL !== BACKUP_URL) {
      originalRequest._retry = true;
      console.warn('[FAILOVER] Primary server unreachable. Switching to Backup API...');
      currentBaseURL = BACKUP_URL;
      isUsingBackup = true;
      originalRequest.baseURL = currentBaseURL;
      return client(originalRequest);
    }

    // Handle unauthorized errors
    // Skip auto-logout for the login endpoint itself.
    // Only treat a 401 as "session expired" when the app actually has a session.
    // A 401 with no token in the store just means "not authenticated" (e.g. a
    // background sync fired after logout) — it must not trigger the alert.
    if (error.response?.status === 401 && !originalRequest.url?.includes('/auth/login') && !originalRequest._retry) {
      originalRequest._retry = true;

      const { token } = getAuthStore().getState();
      if (token && !sessionExpiredEmitted) {
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
