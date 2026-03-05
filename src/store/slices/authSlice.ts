import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, LoginResponse, RegisterData, RegisterWithOtpData } from '../../types';
import api, { setTokens, clearTokens } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import { unregisterToken, cleanupNotifications } from '../../services/notificationService';
import { fetchWalletBalance, resetUserState } from './userSlice';
import { createOrder, resetOrders } from './ordersSlice';

const DEVICE_ID_KEY = '@campusone_device_id';
export async function getDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `mobile-${uuid.v4()}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async ({ username, password }: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const deviceId = await getDeviceId();
      const response = await api.post<{ success: boolean; data: LoginResponse }>('/auth/login', {
        username,
        password,
        deviceId,
        deviceInfo: { platform: 'react-native' },
      });
      const { user, tokens } = response.data.data;
      await setTokens(tokens.accessToken, tokens.refreshToken);
      return user;
    } catch (error: any) {
      const status = error.response?.status;
      const serverMsg = error.response?.data?.message;
      let msg = 'Login failed. Please try again.';
      if (!error.response) {
        msg = 'Network error. Please check your connection.';
      } else if (status === 401 || status === 404) {
        msg = 'Invalid credentials. Please try again.';
      } else if (status === 403) {
        msg = serverMsg || 'Your account is not yet approved';
      } else if (status === 429) {
        msg = 'Too many attempts. Please try again later.';
      } else if (status >= 500) {
        msg = 'Server error. Please try again later.';
      }
      return rejectWithValue(msg);
    }
  },
);

export const sendOtp = createAsyncThunk(
  'auth/sendOtp',
  async ({ phone, purpose }: { phone: string; purpose?: 'login' | 'register' }, { rejectWithValue }) => {
    try {
      const response = await api.post<{ success: boolean; data: { sessionId: string } }>('/auth/send-otp', { phone, purpose });
      return response.data.data;
    } catch (error: any) {
      const status = error.response?.status;
      const serverMsg = error.response?.data?.error?.message || error.response?.data?.message;
      let msg = 'Failed to send OTP. Please try again.';
      if (!error.response) {
        msg = 'Network error. Please check your connection.';
      } else if (status === 409) {
        msg = serverMsg || 'An account with this phone number already exists. Please login instead.';
      } else if (status === 404) {
        msg = 'Failed to send OTP. Please try again.';
      } else if (status === 429) {
        msg = 'Too many attempts. Please try again later.';
      } else if (status >= 500) {
        msg = 'Server error. Please try again later.';
      }
      return rejectWithValue(msg);
    }
  },
);

export const loginWithOtp = createAsyncThunk(
  'auth/loginWithOtp',
  async ({ phone, otp, sessionId }: { phone: string; otp: string; sessionId: string }, { rejectWithValue }) => {
    try {
      const deviceId = await getDeviceId();
      const response = await api.post<{ success: boolean; data: LoginResponse }>('/auth/verify-otp', {
        phone,
        otp,
        sessionId,
        deviceId,
      });
      const { user, tokens } = response.data.data;
      await setTokens(tokens.accessToken, tokens.refreshToken);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'OTP verification failed');
    }
  },
);

export const register = createAsyncThunk(
  'auth/register',
  async (data: RegisterData, { rejectWithValue }) => {
    try {
      const response = await api.post<{ success: boolean; data: { user: User } }>('/auth/register', data);
      return response.data.data.user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Registration failed');
    }
  },
);

export const registerWithOtp = createAsyncThunk(
  'auth/registerWithOtp',
  async ({ name, phone, otp, sessionId }: RegisterWithOtpData, { rejectWithValue }) => {
    try {
      const deviceId = await getDeviceId();
      const response = await api.post<{ success: boolean; data: LoginResponse }>('/auth/register-with-otp', {
        name,
        phone,
        otp,
        sessionId,
        deviceId,
        deviceInfo: { platform: 'react-native' },
      });
      const { user, tokens } = response.data.data;
      await setTokens(tokens.accessToken, tokens.refreshToken);
      return user;
    } catch (error: any) {
      const status = error.response?.status;
      const serverMsg = error.response?.data?.error?.message || error.response?.data?.message;
      let msg = 'Registration failed. Please try again.';
      if (!error.response) {
        msg = 'Network error. Please check your connection.';
      } else if (status === 401) {
        msg = 'Invalid or expired OTP. Please try again.';
      } else if (status === 409) {
        msg = 'An account with this phone number already exists. Please login instead.';
      } else if (status === 429) {
        msg = 'Too many attempts. Please try again later.';
      } else if (serverMsg) {
        msg = serverMsg;
      }
      return rejectWithValue(msg);
    }
  },
);

export const logout = createAsyncThunk('auth/logout', async (_, { dispatch }) => {
  try { await unregisterToken(); } catch { /* ignore */ }
  try { await api.post('/auth/logout'); } catch { /* ignore */ }
  cleanupNotifications();
  await clearTokens();
  dispatch(resetOrders());
  dispatch(resetUserState());
});

export const refreshUserData = createAsyncThunk(
  'auth/refreshUserData',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<{ success: boolean; data: { user: User } }>('/auth/me');
      return response.data.data?.user || response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refresh user data');
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    resetAuth: () => initialState,
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(login.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    // Send OTP
    builder
      .addCase(sendOtp.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(sendOtp.fulfilled, (state) => { state.isLoading = false; })
      .addCase(sendOtp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    // OTP Login
    builder
      .addCase(loginWithOtp.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(loginWithOtp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(loginWithOtp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    // Register — no tokens returned, needs accountant approval
    builder
      .addCase(register.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(register.fulfilled, (state) => {
        state.isLoading = false;
        // Do NOT set isAuthenticated — account needs approval before login
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    // Register with OTP — auto-login on success
    builder
      .addCase(registerWithOtp.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(registerWithOtp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(registerWithOtp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    // Logout
    builder
      .addCase(logout.fulfilled, () => initialState);
    // Refresh user data
    builder
      .addCase(refreshUserData.fulfilled, (state, action) => {
        state.user = action.payload;
      });
    // Sync balance from wallet fetch
    builder
      .addCase(fetchWalletBalance.fulfilled, (state, action) => {
        if (state.user) {
          state.user = { ...state.user, balance: action.payload.balance };
        }
      });
    // Sync balance after order creation (deduct immediately)
    builder
      .addCase(createOrder.fulfilled, (state, action) => {
        if (state.user && action.payload.newBalance !== undefined) {
          state.user = { ...state.user, balance: action.payload.newBalance };
        }
      });
  },
});

export const { clearError, setUser, resetAuth } = authSlice.actions;
export default authSlice.reducer;
