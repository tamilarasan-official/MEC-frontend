import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Transaction, DashboardStats, AnalyticsData, AppNotification, QRPayment } from '../../types';
import api from '../../services/api';

interface OrderStatusPopupData {
  status: 'preparing' | 'ready' | 'completed' | 'cancelled';
  orderNumber: string;
}

interface UserState {
  balance: number;
  transactions: Transaction[];
  dashboardStats: DashboardStats | null;
  analytics: AnalyticsData | null;
  shopDetails: { isActive: boolean; name: string; category?: string; canGenerateQR?: boolean } | null;
  notifications: AppNotification[];
  orderStatusPopup: OrderStatusPopupData | null;
  dietFilter: 'all' | 'veg' | 'nonveg';
  userMode: 'eat' | 'work';
  qrPayments: QRPayment[];
  qrPaymentsLoading: boolean;
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
  orderStatusPopup: null,
  dietFilter: 'all',
  userMode: 'work',
  qrPayments: [],
  qrPaymentsLoading: false,
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
    return res.data.data as { isActive: boolean; name: string; category: string; canGenerateQR: boolean };
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const toggleShopStatus = createAsyncThunk('user/toggleShopStatus', async (_, { rejectWithValue }) => {
  try {
    const res = await api.patch('/owner/shop/toggle');
    return res.data.data as { isActive: boolean };
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const fetchQRPayments = createAsyncThunk('user/fetchQRPayments', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/owner/qr-payments');
    const data = res.data.data;
    return (data?.payments || data || []) as QRPayment[];
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const createQRPayment = createAsyncThunk(
  'user/createQRPayment',
  async (payload: { title: string; description: string; amount: number }, { rejectWithValue }) => {
    try {
      const res = await api.post('/owner/qr-payments', payload);
      return res.data.data as QRPayment;
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed to create QR payment'); }
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearError: (s) => { s.error = null; },
    setBalance: (s, a: PayloadAction<number>) => { s.balance = a.payload; },
    setDietFilter: (s, a: PayloadAction<'all' | 'veg' | 'nonveg'>) => { s.dietFilter = a.payload; },
    setUserMode: (s, a: PayloadAction<'eat' | 'work'>) => { s.userMode = a.payload; },
    setOrderStatusPopup: (s, a: PayloadAction<{ status: string; orderNumber: string } | null>) => {
      s.orderStatusPopup = a.payload as OrderStatusPopupData | null;
    },
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
    builder.addCase(fetchQRPayments.pending, (s) => { s.qrPaymentsLoading = true; });
    builder.addCase(fetchQRPayments.fulfilled, (s, a) => { s.qrPayments = a.payload; s.qrPaymentsLoading = false; });
    builder.addCase(fetchQRPayments.rejected, (s) => { s.qrPaymentsLoading = false; });
    builder.addCase(createQRPayment.fulfilled, (s, a) => { s.qrPayments.unshift(a.payload); });
  },
});

export const {
  clearError, setBalance, setDietFilter, setUserMode,
  setOrderStatusPopup, addNotification, markNotificationRead, clearNotifications, resetUserState,
} = userSlice.actions;
export default userSlice.reducer;
