import api from './api';
import { DashboardStats, AnalyticsData } from '../types';

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
};

export default analyticsService;
