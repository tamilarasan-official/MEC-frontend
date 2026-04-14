import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Transaction, DashboardStats, AnalyticsData, AppNotification, QRPayment } from '../../types';
import api from '../../services/api';
import { createOrder } from './ordersSlice';

interface OrderStatusPopupData {
  status: 'preparing' | 'partially_ready' | 'ready' | 'completed' | 'cancelled';
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
  } catch (e: any) {
    if (__DEV__) console.error('[fetchWalletBalance]', e.response?.status, e.response?.data);
    return rejectWithValue('Failed to load wallet. Please try again.');
  }
});

export const fetchTransactions = createAsyncThunk(
  'user/fetchTransactions',
  async (params: { startDate?: string; endDate?: string } | undefined, { rejectWithValue }) => {
    try {
      const res = await api.get('/student/wallet/transactions', { params });
      const raw = res.data.data?.transactions ?? res.data.data ?? res.data;
      // Normalize: backend lean() queries may return _id instead of id
      return (Array.isArray(raw) ? raw : []).map((tx: any) => ({
        ...tx,
        id: tx.id || tx._id || '',
        userId: tx.userId || (typeof tx.user === 'object' && tx.user ? tx.user._id || tx.user.id : tx.user) || '',
      })) as Transaction[];
    } catch (e: any) {
      if (__DEV__) console.error('[fetchTransactions]', e.response?.status, e.response?.data);
      return rejectWithValue('Failed to load transactions. Please try again.');
    }
  }
);

export const fetchDashboardStats = createAsyncThunk('user/fetchDashboardStats', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/orders/shop/stats');
    return res.data.data as DashboardStats;
  } catch (e: any) {
    if (__DEV__) console.error('[fetchDashboardStats]', e.response?.status, e.response?.data);
    return rejectWithValue('Failed to load dashboard. Please try again.');
  }
});

export const fetchAnalytics = createAsyncThunk('user/fetchAnalytics', async (params: { startDate?: string; endDate?: string } | undefined, { rejectWithValue }) => {
  try {
    const res = await api.get('/orders/shop/analytics', { params });
    return res.data.data as AnalyticsData;
  } catch (e: any) {
    if (__DEV__) console.error('[fetchAnalytics]', e.response?.status, e.response?.data);
    return rejectWithValue('Failed to load analytics. Please try again.');
  }
});

export const fetchShopDetails = createAsyncThunk('user/fetchShopDetails', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/owner/shop');
    return res.data.data as { isActive: boolean; name: string; category: string; canGenerateQR: boolean };
  } catch (e: any) {
    if (__DEV__) console.error('[fetchShopDetails]', e.response?.status, e.response?.data);
    return rejectWithValue('Failed to load shop details. Please try again.');
  }
});

export const toggleShopStatus = createAsyncThunk('user/toggleShopStatus', async (_, { rejectWithValue }) => {
  try {
    const res = await api.patch('/owner/shop/toggle');
    return res.data.data as { isActive: boolean };
  } catch (e: any) {
    if (__DEV__) console.error('[toggleShopStatus]', e.response?.status, e.response?.data);
    return rejectWithValue('Failed to update shop status. Please try again.');
  }
});

export const fetchNotifications = createAsyncThunk('user/fetchNotifications', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/student/notifications', { params: { limit: 50 } });
    const data = res.data.data?.notifications ?? res.data.data ?? res.data;
    return (Array.isArray(data) ? data : []).map((n: any) => ({
      id: n.id || n._id || `notif-${Date.now()}-${Math.random()}`,
      type: n.type || 'system',
      title: n.title || '',
      message: n.message || '',
      data: n.referenceId ? { orderId: n.referenceId } : undefined,
      createdAt: n.createdAt || new Date().toISOString(),
      read: n.isRead ?? false,
    })) as AppNotification[];
  } catch (e: any) {
    if (__DEV__) console.error('[fetchNotifications]', e.response?.status, e.response?.data);
    return rejectWithValue('Failed to load notifications. Please try again.');
  }
});

export const fetchQRPayments = createAsyncThunk('user/fetchQRPayments', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/owner/qr-payments');
    const data = res.data.data;
    const payments = (data?.payments || data || []) as QRPayment[];
    if (__DEV__) console.log('[fetchQRPayments] got', payments.length, 'payments');
    return payments;
  } catch (e: any) {
    if (__DEV__) console.error('[fetchQRPayments] FAILED:', e.response?.status, e.response?.data?.message || e.message);
    return rejectWithValue('Failed to load QR payments. Please try again.');
  }
});

export const createQRPayment = createAsyncThunk(
  'user/createQRPayment',
  async (payload: { title: string; description: string; amount: number }, { rejectWithValue }) => {
    try {
      const res = await api.post('/owner/qr-payments', payload);
      return res.data.data as QRPayment;
    } catch (e: any) {
      const status = e.response?.status;
      if (__DEV__) console.error('[createQRPayment]', status, e.response?.data);
      let msg = 'Failed to create QR payment. Please try again.';
      if (status === 400) msg = 'Invalid QR payment details. Please check and try again.';
      else if (status === 402) msg = 'Insufficient balance for this QR payment.';
      else if (status >= 500) msg = 'Server error. Please try again later.';
      return rejectWithValue(msg);
    }
  }
);

export const updateQRPaymentAmount = createAsyncThunk(
  'user/updateQRPaymentAmount',
  async ({ id, amount }: { id: string; amount: number }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/owner/qr-payments/${id}/amount`, { amount });
      return res.data.data as { id: string; amount: number };
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.error?.message || 'Failed to update amount');
    }
  }
);

export const cancelQRPayment = createAsyncThunk(
  'user/cancelQRPayment',
  async ({ id }: { id: string }, { rejectWithValue }) => {
    try {
      await api.delete(`/owner/qr-payments/${id}`);
      return id;
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.error?.message || 'Failed to cancel QR payment');
    }
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
    addNotification: (s, a: PayloadAction<AppNotification>) => {
      const { title, message } = a.payload;
      // Reject notifications where both title and message are empty/whitespace
      if ((!title || !title.trim()) && (!message || !message.trim())) return;
      s.notifications.unshift(a.payload);
      // Cap at 200 entries to prevent unbounded memory growth
      if (s.notifications.length > 200) {
        s.notifications.length = 200;
      }
    },
    markNotificationRead: (s, a: PayloadAction<string>) => {
      const n = s.notifications.find(x => x.id === a.payload);
      if (n) n.read = true;
    },
    removeNotification: (s, a: PayloadAction<string>) => {
      s.notifications = s.notifications.filter(n => n.id !== a.payload);
    },
    clearNotifications: (s) => { s.notifications = []; },
    resetUserState: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(fetchWalletBalance.fulfilled, (s, a) => { s.balance = a.payload.balance; });
    builder.addCase(fetchTransactions.fulfilled, (s, a) => { s.transactions = a.payload; });
    // Sync balance after order creation
    builder.addCase(createOrder.fulfilled, (s, a) => {
      if (a.payload.newBalance !== undefined) s.balance = a.payload.newBalance;
    });
    builder.addCase(fetchDashboardStats.fulfilled, (s, a) => { s.dashboardStats = a.payload; });
    builder.addCase(fetchNotifications.fulfilled, (s, a) => {
      // Merge backend notifications with existing in-memory ones (dedup by id)
      const existingIds = new Set(s.notifications.map(n => n.id));
      const newOnes = a.payload.filter(n => !existingIds.has(n.id));
      if (newOnes.length > 0) {
        s.notifications = [...newOnes, ...s.notifications]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 200);
      }
    });
    builder.addCase(fetchAnalytics.pending, (s) => { s.isLoading = true; s.error = null; });
    builder.addCase(fetchAnalytics.fulfilled, (s, a) => { s.isLoading = false; s.analytics = a.payload; });
    builder.addCase(fetchAnalytics.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; });
    builder.addCase(fetchShopDetails.fulfilled, (s, a) => { s.shopDetails = a.payload; });
    builder.addCase(toggleShopStatus.fulfilled, (s, a) => {
      if (s.shopDetails) s.shopDetails.isActive = a.payload.isActive;
    });
    builder.addCase(fetchQRPayments.pending, (s) => { s.qrPaymentsLoading = true; });
    builder.addCase(fetchQRPayments.fulfilled, (s, a) => { s.qrPayments = a.payload; s.qrPaymentsLoading = false; });
    builder.addCase(fetchQRPayments.rejected, (s) => { s.qrPaymentsLoading = false; });
    builder.addCase(createQRPayment.fulfilled, (s, a) => {
      // Merge defaults for fields not returned by the create API
      s.qrPayments.unshift({
        ...a.payload,
        status: a.payload.status || 'active',
        paidCount: a.payload.paidCount || 0,
        totalCollected: a.payload.totalCollected || 0,
        payers: a.payload.payers || [],
        description: a.payload.description || '',
      });
    });
    builder.addCase(updateQRPaymentAmount.fulfilled, (s, a) => {
      const p = s.qrPayments.find(x => x.id === a.payload.id);
      if (p) p.amount = a.payload.amount;
    });
    builder.addCase(cancelQRPayment.fulfilled, (s, a) => {
      s.qrPayments = s.qrPayments.filter(x => x.id !== a.payload);
    });
  },
});

export const {
  clearError, setBalance, setDietFilter, setUserMode,
  setOrderStatusPopup, addNotification, markNotificationRead, removeNotification, clearNotifications, resetUserState,
} = userSlice.actions;
export default userSlice.reducer;
