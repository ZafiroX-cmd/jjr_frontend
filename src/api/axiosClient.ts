import axios from 'axios';

function resolveApiUrl(): string {
  const runtime = typeof window !== 'undefined' ? window.__APP_CONFIG__?.apiUrl?.trim() : '';
  if (runtime) return runtime;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return 'http://localhost:5192/api';
}

const axiosClient = axios.create({
  baseURL: resolveApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;