import api from './api';
import { Transaction } from '../types';

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
  getLeaderboard: async (): Promise<any[]> => {
    const res = await api.get('/student/leaderboard');
    return res.data.data || res.data;
  },
  getPendingPayments: async (): Promise<any[]> => {
    const res = await api.get('/student/payments/pending');
    return res.data.data || res.data;
  },
  payAdhocPayment: async (paymentId: string): Promise<any> => {
    const res = await api.post(`/student/payments/${paymentId}/pay`);
    return res.data.data;
  },
  getPaymentHistory: async (): Promise<any[]> => {
    const res = await api.get('/student/payments/history');
    return res.data.data || res.data;
  },
  // Razorpay
  createRazorpayOrder: async (amount: number): Promise<{ orderId: string; amount: number; currency: string; keyId: string }> => {
    const res = await api.post('/razorpay/create-order', { amount });
    return res.data.data;
  },
  verifyRazorpayPayment: async (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }): Promise<any> => {
    const res = await api.post('/razorpay/verify-payment', data);
    return res.data.data;
  },
};

export default walletService;
