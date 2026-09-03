import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

