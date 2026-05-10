import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as Keychain from 'react-native-keychain';
import Config from 'react-native-config';
import DeviceInfo from 'react-native-device-info';
import uuid from 'react-native-uuid';

// ── Server origin ───────────────────────────────────────────────
export const API_ORIGIN = 'https://campusoneapi.madrascollege.ac.in';

const BASE_URL = `${API_ORIGIN}/api/v1`;

const KEYCHAIN_TOKEN_SERVICE = 'com.campusone.tokens';
const KEYCHAIN_DEVICE_ID_SERVICE = 'com.campusone.deviceid';

// API key for mobile app verification — must be set in .env as APP_API_KEY
// Never hardcode a fallback — if the key is missing the app should fail loudly at startup
const APP_API_KEY = Config.APP_API_KEY as string;
if (!APP_API_KEY) {
  throw new Error('[Security] APP_API_KEY is not configured. Set APP_API_KEY in your .env file.');
}
const APP_VERSION: string = DeviceInfo.getVersion();

// Max retries for token refresh before giving up
const TOKEN_REFRESH_MAX_RETRIES = 2;
const TOKEN_REFRESH_RETRY_DELAY_MS = 1500;

// Cooldown after a 429 on /refresh — block further attempts for 60s
let refreshRateLimitedUntil = 0;

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
};

export const clearTokens = async () => {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_TOKEN_SERVICE });
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
    // Generate a cryptographically random device ID using uuid v4
    const id = (uuid.v4() as string).replace(/-/g, '');
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
      // If we're still in a rate-limit cooldown window, bail out immediately
      if (Date.now() < refreshRateLimitedUntil) {
        return Promise.reject(error);
      }
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
            const deviceId = await getOrCreateDeviceId();
            const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh }, {
              headers: { 'X-App-Key': APP_API_KEY, 'X-Device-Id': deviceId },
            });
            const tokenData = res.data.data?.tokens || res.data.data;
            const { accessToken, refreshToken: newRefreshToken } = tokenData;
            await setTokens(accessToken, newRefreshToken || refresh);
            processQueue(null, accessToken);
            if (original.headers) original.headers.Authorization = `Bearer ${accessToken}`;
            return api(original);
          } catch (retryErr: any) {
            lastError = retryErr;
            // Don't retry on 401/403 (invalid token) or 429 (rate limited)
            if (retryErr.response?.status === 401 || retryErr.response?.status === 403) break;
            if (retryErr.response?.status === 429) {
              refreshRateLimitedUntil = Date.now() + 60_000; // back off for 60s
              break;
            }
            // Retry on network errors or 5xx
            if (attempt < TOKEN_REFRESH_MAX_RETRIES) {
              await delay(TOKEN_REFRESH_RETRY_DELAY_MS);
            }
          }
        }
        throw lastError;
      } catch (err) {
        processQueue(err as Error);
        // Only clear tokens and logout if the refresh token is genuinely rejected
        // by the server (401/403 — account deactivated, token invalid, etc.)
        const isServerRejection = (err as any)?.response?.status === 401 || (err as any)?.response?.status === 403;
        if (isServerRejection) {
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
