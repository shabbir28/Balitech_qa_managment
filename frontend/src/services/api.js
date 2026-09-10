import axios from 'axios';

// Without VITE_API_URL a production build must talk to its own origin — a
// hardcoded localhost fallback only ever works on the server itself.
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const configuredUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
// Every backend route is mounted under /api, so tolerate the suffix being
// omitted from the env var rather than 404-ing every request.
const normalizedUrl = configuredUrl && !/\/api$/.test(configuredUrl)
  ? `${configuredUrl}/api`
  : configuredUrl;
const API_BASE_URL = normalizedUrl || (isLocalHost ? 'http://localhost:5000/api' : '/api');

// Default API instance — 30 second timeout for normal requests
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds (was 300s which caused UI to hang)
});

// Upload-specific instance — 5 minute timeout for large file uploads
export const uploadApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes for large file uploads
});

// Attach JWT token to both instances
const attachToken = (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

// Request interceptors
api.interceptors.request.use(attachToken, (error) => Promise.reject(error));
uploadApi.interceptors.request.use(attachToken, (error) => Promise.reject(error));

// Handle auth errors (redirect to login on 401)
const handleAuthError = (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
};

// Response interceptors
api.interceptors.response.use((response) => response, handleAuthError);
uploadApi.interceptors.response.use((response) => response, handleAuthError);

export default api;

