import axios, { InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/useAuthStore';

const getBaseUrl = () => {
  if (__DEV__) {
    // For local development
    const debuggerHost = Constants.expoConfig?.hostUri;
    // Android emulator uses 10.0.2.2, iOS uses localhost
    // Physical devices use the machine's local IP (debuggerHost)
    const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
    const url = `http://${localhost}:5000/api`;
    console.log('[API] Using Base URL:', url);
    return url;
  }
  // Production URL
  return 'https://happy-renting.onrender.com/api';
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
      console.log('[API] 401 detected, logging out...');
      await useAuthStore.getState().logout();
    }
    
    return Promise.reject(error);
  }
);

export default client;
