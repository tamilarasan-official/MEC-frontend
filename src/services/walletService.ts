import api from './api';
import { Transaction } from '../types';

// Fallback Razorpay key — backend returns the key in the create-order response.
// This constant is only used if the backend omits keyId in its response.
const RAZORPAY_KEY_FALLBACK = '';

const walletService = {
  getBalance: async (): Promise<{ balance: number }> => {
    const res = await api.get('/student/wallet');
    return res.data.data;
  },
  getTransactions: async (): Promise<Transaction[]> => {
    const res = await api.get('/student/wallet/transactions');
    return res.data.data || res.data;
  },
  getProfile: async (): Promise<any> => {
    const res = await api.get('/student/profile');
    return res.data.data;
  },
  updateProfile: async (data: any): Promise<any> => {
    const res = await api.put('/student/profile', data);
    return res.data.data;
  },
  uploadAvatar: async (imageUri: string, imageName = 'avatar.jpg', imageType = 'image/jpeg'): Promise<{ avatarUrl: string }> => {
    const formData = new FormData();
    formData.append('avatar', { uri: imageUri, type: imageType, name: imageName } as any);
    const res = await api.put('/student/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
  getLeaderboard: async (): Promise<any[]> => {
    const res = await api.get('/student/leaderboard');
    const raw = res.data.data || res.data;
    return (Array.isArray(raw) ? raw : []).map((e: any) => ({
      userId: e._id || e.id || '',
      userName: e.name || e.username || '',
      avatarUrl: e.avatarUrl,
      totalOrders: e.totalOrders || 0,
      totalSpent: e.totalSpent || 0,
      rank: e.rank,
    }));
  },
  getPendingPayments: async (): Promise<any[]> => {
    const res = await api.get('/student/payments/pending');
    const raw = res.data.data || res.data;
    return (Array.isArray(raw) ? raw : []).map((p: any) => ({
      ...p,
      id: p._id || p.id || '',
    }));
  },
  payAdhocPayment: async (paymentId: string): Promise<any> => {
    const res = await api.post(`/student/payments/${paymentId}/pay`);
    return res.data.data;
  },
  getPaymentHistory: async (): Promise<any[]> => {
    const res = await api.get('/student/payments/history');
    return res.data.data || res.data;
  },
  // Notifications
  getNotifications: async (limit = 20, skip = 0): Promise<{ notifications: any[]; total: number }> => {
    const res = await api.get('/student/notifications', { params: { limit, skip } });
    const d = res.data.data || res.data;
    return { notifications: d.notifications || d || [], total: d.total || 0 };
  },
  markAllNotificationsRead: async (): Promise<void> => {
    await api.patch('/student/notifications/read-all');
  },
  markNotificationRead: async (notificationId: string): Promise<void> => {
    await api.patch(`/student/notifications/${notificationId}/read`);
  },
  deleteNotification: async (notificationId: string): Promise<void> => {
    await api.delete(`/student/notifications/${notificationId}`);
  },
  clearAllNotifications: async (): Promise<void> => {
    await api.delete('/student/notifications');
  },
  // Razorpay
  createRazorpayOrder: async (amount: number): Promise<{ orderId: string; amount: number; currency: string; keyId: string }> => {
    const res = await api.post('/razorpay/create-order', { amount });
    const d = res.data.data;
    return {
      orderId: d.id || d.orderId || '',
      amount: d.amount || amount,
      currency: d.currency || 'INR',
      keyId: d.key || d.keyId || RAZORPAY_KEY_FALLBACK,
    };
  },
  verifyRazorpayPayment: async (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }): Promise<any> => {
    const payload = {
      orderId: data.razorpay_order_id,
      paymentId: data.razorpay_payment_id,
      signature: data.razorpay_signature,
    };
    const res = await api.post('/razorpay/verify-payment', payload);
    return res.data.data;
  },
};

export default walletService;
