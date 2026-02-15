import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Transaction, DashboardStats, AnalyticsData, AppNotification } from '../../types';
import api from '../../services/api';

interface UserState {
  balance: number;
  transactions: Transaction[];
  dashboardStats: DashboardStats | null;
  analytics: AnalyticsData | null;
  shopDetails: { isActive: boolean; name: string } | null;
  notifications: AppNotification[];
  dietFilter: 'all' | 'veg' | 'nonveg';
  userMode: 'eat' | 'work';
  isLoading: boolean;
  error: string | null;
}

const initialState: UserState = {
  balance: 0,
  transactions: [],
  dashboardStats: null,
  analytics: null,
  shopDetails: null,
  notifications: [],
  dietFilter: 'all',
  userMode: 'work',
  isLoading: false,
  error: null,
};

export const fetchWalletBalance = createAsyncThunk('user/fetchWallet', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/student/wallet');
    return res.data.data as { balance: number };
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const fetchTransactions = createAsyncThunk('user/fetchTransactions', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/student/wallet/transactions');
    return (res.data.data || res.data) as Transaction[];
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const fetchDashboardStats = createAsyncThunk('user/fetchDashboardStats', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/orders/shop/stats');
    return res.data.data as DashboardStats;
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const fetchAnalytics = createAsyncThunk('user/fetchAnalytics', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/orders/shop/analytics');
    return res.data.data as AnalyticsData;
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const fetchShopDetails = createAsyncThunk('user/fetchShopDetails', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/owner/shop');
    return res.data.data as { isActive: boolean; name: string };
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const toggleShopStatus = createAsyncThunk('user/toggleShopStatus', async (_, { rejectWithValue }) => {
  try {
    const res = await api.patch('/owner/shop/toggle');
    return res.data.data as { isActive: boolean };
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearError: (s) => { s.error = null; },
    setBalance: (s, a: PayloadAction<number>) => { s.balance = a.payload; },
    setDietFilter: (s, a: PayloadAction<'all' | 'veg' | 'nonveg'>) => { s.dietFilter = a.payload; },
    setUserMode: (s, a: PayloadAction<'eat' | 'work'>) => { s.userMode = a.payload; },
    setOrderStatusPopup: (_s, _a: PayloadAction<{ status: string; orderNumber: string } | null>) => { /* handled via component state */ },
    addNotification: (s, a: PayloadAction<AppNotification>) => { s.notifications.unshift(a.payload); },
    markNotificationRead: (s, a: PayloadAction<string>) => {
      const n = s.notifications.find(x => x.id === a.payload);
      if (n) n.read = true;
    },
    clearNotifications: (s) => { s.notifications = []; },
    resetUserState: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(fetchWalletBalance.fulfilled, (s, a) => { s.balance = a.payload.balance; });
    builder.addCase(fetchTransactions.fulfilled, (s, a) => { s.transactions = a.payload; });
    builder.addCase(fetchDashboardStats.fulfilled, (s, a) => { s.dashboardStats = a.payload; });
    builder.addCase(fetchAnalytics.fulfilled, (s, a) => { s.analytics = a.payload; });
    builder.addCase(fetchShopDetails.fulfilled, (s, a) => { s.shopDetails = a.payload; });
    builder.addCase(toggleShopStatus.fulfilled, (s, a) => {
      if (s.shopDetails) s.shopDetails.isActive = a.payload.isActive;
    });
  },
});

export const {
  clearError, setBalance, setDietFilter, setUserMode,
  setOrderStatusPopup, addNotification, markNotificationRead, clearNotifications, resetUserState,
} = userSlice.actions;
export default userSlice.reducer;
