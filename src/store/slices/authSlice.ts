import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, LoginResponse, RegisterData } from '../../types';
import api, { setTokens, clearTokens } from '../../services/api';
import { unregisterToken, cleanupNotifications } from '../../services/notificationService';

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
      const response = await api.post<{ success: boolean; data: LoginResponse }>('/auth/login', {
        username,
        password,
        deviceId: `mobile-${Date.now()}`,
        deviceInfo: { platform: 'react-native' },
      });
      const { user, tokens } = response.data.data;
      await setTokens(tokens.accessToken, tokens.refreshToken);
      return user;
    } catch (error: any) {
      const status = error.response?.status;
      const serverMsg = error.response?.data?.message;
      let msg = serverMsg || 'Login failed. Please try again.';
      if (!serverMsg) {
        if (status === 401) msg = 'Invalid username or password';
        else if (status === 403) msg = 'Your account is not yet approved';
        else if (status === 404) msg = 'Account not found. Please register first.';
        else if (status === 429) msg = 'Too many attempts. Please try again later.';
        else if (status >= 500) msg = 'Server error. Please try again later.';
        else if (!error.response) msg = 'Network error. Please check your connection.';
      }
      return rejectWithValue(msg);
    }
  },
);

export const loginWithOtp = createAsyncThunk(
  'auth/loginWithOtp',
  async ({ phone, otp, sessionId }: { phone: string; otp: string; sessionId?: string }, { rejectWithValue }) => {
    try {
      const response = await api.post<{ success: boolean; data: LoginResponse }>('/auth/verify-otp', {
        phoneNumber: phone,
        otp,
        sessionId,
        deviceId: `mobile-${Date.now()}`,
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

export const logout = createAsyncThunk('auth/logout', async () => {
  try { await unregisterToken(); } catch { /* ignore */ }
  try { await api.post('/auth/logout'); } catch { /* ignore */ }
  cleanupNotifications();
  await clearTokens();
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
    // Logout
    builder
      .addCase(logout.fulfilled, () => initialState);
    // Refresh user data
    builder
      .addCase(refreshUserData.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { clearError, setUser, resetAuth } = authSlice.actions;
export default authSlice.reducer;
