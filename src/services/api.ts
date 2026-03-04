import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Server origin (single source of truth) ──────────────────────
// Change this ONE value when switching between dev / staging / production.
// Local:      http://192.168.1.8:3030
// Dev:        https://backend.mec.welocalhost.com
// Production: https://campusoneapi.madrascollege.ac.in
export const API_ORIGIN = 'https://campusoneapi.madrascollege.ac.in';

const BASE_URL = `${API_ORIGIN}/api/v1`;

const ACCESS_TOKEN_KEY = '@madrasone_access_token';
const REFRESH_TOKEN_KEY = '@madrasone_refresh_token';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export const getAccessToken = async () => AsyncStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = async () => AsyncStorage.getItem(REFRESH_TOKEN_KEY);

export const setTokens = async (access: string, refresh: string) => {
  await AsyncStorage.multiSet([[ACCESS_TOKEN_KEY, access], [REFRESH_TOKEN_KEY, refresh]]);
};

export const clearTokens = async () => {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
};

// Request interceptor
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor with token refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v?: unknown) => void; reject: (r?: unknown) => void }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(p => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isAuthRoute = original.url?.includes('/auth/login') || original.url?.includes('/auth/register') || original.url?.includes('/auth/verify-otp') || original.url?.includes('/auth/register-with-otp');
    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          if (original.headers) original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const refresh = await getRefreshToken();
        if (!refresh) throw new Error('No refresh token');
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh });
        const tokenData = res.data.data?.tokens || res.data.data;
        const { accessToken, refreshToken: newRefreshToken } = tokenData;
        await setTokens(accessToken, newRefreshToken || refresh);
        processQueue(null, accessToken);
        if (original.headers) original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (err) {
        processQueue(err as Error);
        await clearTokens();
        // Force logout on token refresh failure
        try {
          const { store } = require('../store');
          store.dispatch({ type: 'auth/resetAuth' });
        } catch {}
        throw err;
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
