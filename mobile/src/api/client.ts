import axios, { InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/useAuthStore';
import { appEvents, SESSION_EXPIRED_EVENT } from '../utils/events';

const PRODUCTION_API = 'https://happy-renting.onrender.com/api';

const getBaseUrl = () => {
  // Default to production API
  let url = PRODUCTION_API;

  if (__DEV__) {
    // Check if we should use local backend (set USE_LOCAL_API=true in app.json extra or expo env)
    const useLocal = Constants.expoConfig?.extra?.USE_LOCAL_API === true;
    if (useLocal) {
      const debuggerHost = Constants.expoConfig?.hostUri;
      const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
      url = `http://${localhost}:5000/api`;
    }
  }

  if (__DEV__) {
    console.log('[API] Using Base URL:', url);
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
    const token = useAuthStore.getState().token;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (__DEV__) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        hasToken: !!token,
      });
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
client.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`[API Response] ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (__DEV__) {
      console.warn(`[API Error] ${error.response?.status} ${originalRequest?.url}`, error.response?.data);
    }

    // Handle unauthorized errors
    // Skip auto-logout for the login endpoint itself
    if (error.response?.status === 401 && !originalRequest.url?.includes('/auth/login') && !originalRequest._retry) {
      originalRequest._retry = true;
      if (__DEV__) {
        console.log('[API] 401 detected, logging out...');
      }
      appEvents.emit(SESSION_EXPIRED_EVENT);
      await useAuthStore.getState().logout();
    }
    
    return Promise.reject(error);
  }
);

export default client;
