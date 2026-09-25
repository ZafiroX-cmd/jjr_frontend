import axios from 'axios';

function resolveApiUrl(): string {
  const runtime = typeof window !== 'undefined' ? window.__APP_CONFIG__?.apiUrl?.trim() : '';
  let url = runtime || import.meta.env.VITE_API_URL || 'http://localhost:5192/api';

  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    url.startsWith('http://') &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)
  ) {
    url = `https://${url.slice('http://'.length)}`;
  }

  return url;
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