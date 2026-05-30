import api from './api';
import { MyStationeryRequest, StationeryRequestGroup } from '../types';

const stationeryRequestService = {
  async create(shopId: string, message: string): Promise<{ id: string; message: string; expiresAt: string; createdAt: string }> {
    const res = await api.post('/stationery-requests', { shopId, message });
    return res.data.data;
  },

  async listForShop(shopId?: string, status: 'active' | 'resolved' | 'all' = 'active'): Promise<StationeryRequestGroup[]> {
    const res = await api.get('/stationery-requests/shop', { params: { ...(shopId ? { shopId } : {}), status } });
    const raw = res.data.data || [];
    return Array.isArray(raw) ? raw : [];
  },

  async listMine(): Promise<MyStationeryRequest[]> {
    const res = await api.get('/stationery-requests/my');
    const raw = res.data.data || [];
    return Array.isArray(raw) ? raw : [];
  },

  async resolve(id: string): Promise<void> {
    await api.post(`/stationery-requests/${id}/resolve`);
  },
};

export default stationeryRequestService;
