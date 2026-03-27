import api from './api';
import { DashboardStats, AnalyticsData } from '../types';

export interface OwnerTransfer {
  period: string;
  amount: number;
  status: 'pending' | 'completed';
  completedAt?: string;
  notes?: string;
}

export interface StationeryAnalytics {
  todaySales: number;
  weekSales: number;
  thisMonthRevenue: number;
  alltimeSales: number;
  todayOrders: number;
  weekOrders: number;
  thisMonthOrders: number;
  alltimeOrders: number;
  totalPages: number;
  totalCopies: number;
  uniqueCustomers: number;
  completionRate: number;
  colorDistribution: Array<{ type: string; count: number }>;
  paperDistribution: Array<{ size: string; count: number }>;
}

export interface OwnerPayablesData {
  currentMonth: {
    period: string;
    payableAmount: number;
    transferStatus: 'pending' | 'completed';
    completedAt?: string;
  };
  transfers: OwnerTransfer[];
}

const analyticsService = {
  getOwnerDashboard: async (): Promise<DashboardStats> => {
    const res = await api.get('/orders/shop/stats');
    return res.data.data;
  },
  getOwnerAnalytics: async (): Promise<AnalyticsData> => {
    const res = await api.get('/orders/shop/analytics');
    return res.data.data;
  },
  getCaptainStats: async (): Promise<DashboardStats> => {
    const res = await api.get('/orders/shop/stats');
    return res.data.data;
  },
  // Owner captain management
  getCaptains: async (): Promise<any[]> => {
    const res = await api.get('/owner/captains');
    return res.data.data || res.data;
  },
  addCaptain: async (data: { username: string; name: string; email: string; password: string; phone: string }): Promise<any> => {
    const res = await api.post('/owner/captains', data);
    return res.data.data;
  },
  removeCaptain: async (id: string): Promise<void> => {
    await api.delete(`/owner/captains/${id}`);
  },
  getOwnerPayables: async (): Promise<OwnerPayablesData> => {
    const res = await api.get('/owner/payables');
    return res.data.data;
  },
  getStationeryAnalytics: async (): Promise<StationeryAnalytics> => {
    const res = await api.get('/orders/shop/analytics/stationery');
    return res.data.data;
  },
};

export default analyticsService;
