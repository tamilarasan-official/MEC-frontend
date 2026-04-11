import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as Keychain from 'react-native-keychain';
import Config from 'react-native-config';

// ── Server origin ───────────────────────────────────────────────
export const API_ORIGIN = Config.API_ORIGIN || 'http://127.0.0.1:5000';

const BASE_URL = `${API_ORIGIN}/api/v1`;

const KEYCHAIN_TOKEN_SERVICE = 'com.campusone.tokens';
const KEYCHAIN_ACTIVITY_SERVICE = 'com.campusone.activity';
const KEYCHAIN_DEVICE_ID_SERVICE = 'com.campusone.deviceid';

// API key for mobile app verification — loaded from .env via react-native-config
// Hardcoded fallback ensures the app works even if Config fails to inject at build time
const APP_API_KEY = Config.APP_API_KEY || '272183449088151d1938eca9e9de6cd2cb7a7001ad073cc050352117c1b52ca3';
const APP_VERSION: string = require('../../package.json').version;

// Session inactivity limit — 3 days in milliseconds
const SESSION_MAX_INACTIVE_MS = 3 * 24 * 60 * 60 * 1000;

// Max retries for token refresh before giving up
const TOKEN_REFRESH_MAX_RETRIES = 2;
const TOKEN_REFRESH_RETRY_DELAY_MS = 1500;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-App-Key': APP_API_KEY,
    'X-App-Version': APP_VERSION,
  },
});

// ── Token storage (Keychain — secure, encrypted) ───────────────────
interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

async function getStoredTokens(): Promise<StoredTokens | null> {
  try {
    const result = await Keychain.getGenericPassword({ service: KEYCHAIN_TOKEN_SERVICE });
    if (!result) return null;
    return JSON.parse(result.password);
  } catch {
    return null;
  }
}

export const getAccessToken = async (): Promise<string | null> => {
  const tokens = await getStoredTokens();
  return tokens?.accessToken ?? null;
};

export const getRefreshToken = async (): Promise<string | null> => {
  const tokens = await getStoredTokens();
  return tokens?.refreshToken ?? null;
};

export const setTokens = async (access: string, refresh: string) => {
  await Keychain.setGenericPassword(
    'tokens',
    JSON.stringify({ accessToken: access, refreshToken: refresh }),
    { service: KEYCHAIN_TOKEN_SERVICE },
  );
  // Also stamp activity — separate service, no race condition with tokens
  await updateLastActivity();
};

export const clearTokens = async () => {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_TOKEN_SERVICE });
  await Keychain.resetGenericPassword({ service: KEYCHAIN_ACTIVITY_SERVICE });
};

// ── Activity tracking (separate Keychain service — never touches tokens) ──

/** Update the last activity timestamp */
export const updateLastActivity = async () => {
  try {
    await Keychain.setGenericPassword(
      'activity',
      Date.now().toString(),
      { service: KEYCHAIN_ACTIVITY_SERVICE },
    );
  } catch {
    // Non-critical — don't let activity tracking break the app
  }
};

/** Check if session has been inactive for more than 3 days */
export const isSessionExpired = async (): Promise<boolean> => {
  try {
    const tokens = await getStoredTokens();
    if (!tokens) return true;
    const result = await Keychain.getGenericPassword({ service: KEYCHAIN_ACTIVITY_SERVICE });
    if (!result) return false; // No activity recorded yet — treat as active
    const lastActivity = parseInt(result.password, 10);
    if (isNaN(lastActivity)) return false;
    return (Date.now() - lastActivity) > SESSION_MAX_INACTIVE_MS;
  } catch {
    return false; // If we can't check, assume not expired
  }
};

/** Helper: delay for retry logic */
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ── Device ID (stable per-install, for per-device rate limiting) ──────────
// Sent as X-Device-Id header so the backend can key rate limits per device
// instead of per IP — prevents MEC WiFi users from sharing one rate-limit bucket.
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const stored = await Keychain.getGenericPassword({ service: KEYCHAIN_DEVICE_ID_SERVICE });
    if (stored) return stored.password;
    // Generate a 32-char hex device ID and persist it
    const id = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    await Keychain.setGenericPassword('device', id, { service: KEYCHAIN_DEVICE_ID_SERVICE });
    return id;
  } catch {
    return '';
  }
}

// Request interceptor
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Attach device ID so the backend rate-limiter keys per device, not per IP
  const deviceId = await getOrCreateDeviceId();
  if (deviceId && config.headers) {
    config.headers['X-Device-Id'] = deviceId;
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
    // 426 Upgrade Required — app version too old, force update
    if (error.response?.status === 426) {
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.emit('FORCE_UPDATE_REQUIRED', error.response.data);
      return Promise.reject(error);
    }

    // 503 Service Unavailable — app may be in maintenance mode
    if (error.response?.status === 503) {
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.emit('MAINTENANCE_MODE_DETECTED');
      return Promise.reject(error);
    }

    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isAuthRoute = original.url?.includes('/auth/login') || original.url?.includes('/auth/register') || original.url?.includes('/auth/verify-otp') || original.url?.includes('/auth/register-with-otp');
    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve: resolve as (v?: unknown) => void, reject });
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

        // Retry token refresh up to TOKEN_REFRESH_MAX_RETRIES times
        let lastError: unknown;
        for (let attempt = 0; attempt <= TOKEN_REFRESH_MAX_RETRIES; attempt++) {
          try {
            const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh }, {
              headers: { 'X-App-Key': APP_API_KEY },
            });
            const tokenData = res.data.data?.tokens || res.data.data;
            const { accessToken, refreshToken: newRefreshToken } = tokenData;
            await setTokens(accessToken, newRefreshToken || refresh);
            processQueue(null, accessToken);
            if (original.headers) original.headers.Authorization = `Bearer ${accessToken}`;
            return api(original);
          } catch (retryErr: any) {
            lastError = retryErr;
            // Don't retry on 401/403 — token is genuinely invalid
            if (retryErr.response?.status === 401 || retryErr.response?.status === 403) break;
            // Retry on network errors or 5xx
            if (attempt < TOKEN_REFRESH_MAX_RETRIES) {
              await delay(TOKEN_REFRESH_RETRY_DELAY_MS);
            }
          }
        }
        throw lastError;
      } catch (err) {
        processQueue(err as Error);
        // Only clear tokens and logout if session is expired (3-day inactivity)
        // or if the refresh token is genuinely rejected by the server (401/403)
        const isServerRejection = (err as any)?.response?.status === 401 || (err as any)?.response?.status === 403;
        const expired = await isSessionExpired();
        if (isServerRejection || expired) {
          await clearTokens();
          try {
            const { store } = require('../store');
            store.dispatch({ type: 'auth/resetAuth' });
          } catch {}
        }
        throw err;
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
