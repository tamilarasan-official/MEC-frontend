import api from './api';
import { FoodItem, Shop } from '../types';

const menuService = {
  getShops: async (): Promise<Shop[]> => {
    const res = await api.get('/shops');
    const d = res.data.data || res.data;
    return Array.isArray(d) ? d : d.shops || [];
  },
  getShopMenu: async (shopId: string, category?: string, search?: string): Promise<FoodItem[]> => {
    const params: any = {};
    if (category) params.categoryId = category;
    if (search) params.search = search;
    const res = await api.get(`/shops/${shopId}/menu`, { params });
    return res.data.data || res.data;
  },
  getShopCategories: async (shopId: string): Promise<string[]> => {
    const res = await api.get(`/shops/${shopId}/categories`);
    return res.data.data || res.data;
  },
  searchAllMenuItems: async (shops: Shop[], query: string): Promise<FoodItem[]> => {
    const results = await Promise.all(
      shops.map(s => menuService.getShopMenu(s.id, undefined, query).catch(() => [] as FoodItem[])),
    );
    return results.flat();
  },
  // Owner
  getOwnerMenu: async (): Promise<FoodItem[]> => {
    const res = await api.get('/owner/menu');
    return res.data.data || res.data;
  },
  createItem: async (data: Partial<FoodItem>): Promise<FoodItem> => {
    const res = await api.post('/owner/menu', data);
    return res.data.data;
  },
  updateItem: async (id: string, data: Partial<FoodItem>): Promise<FoodItem> => {
    const res = await api.put(`/owner/menu/${id}`, data);
    return res.data.data;
  },
  toggleAvailability: async (id: string, isAvailable: boolean): Promise<FoodItem> => {
    const res = await api.patch(`/owner/menu/${id}/availability`, { isAvailable });
    return res.data.data;
  },
  setOffer: async (id: string, offerPrice: number): Promise<FoodItem> => {
    const res = await api.post(`/owner/menu/${id}/offer`, { offerPrice });
    return res.data.data;
  },
  removeOffer: async (id: string): Promise<FoodItem> => {
    const res = await api.delete(`/owner/menu/${id}/offer`);
    return res.data.data;
  },
  deleteItem: async (id: string): Promise<void> => {
    await api.delete(`/owner/menu/${id}`);
  },
  getShopById: async (shopId: string): Promise<Shop> => {
    const res = await api.get(`/shops/${shopId}`);
    return res.data.data;
  },
  // Owner category management
  getOwnerCategories: async (): Promise<any[]> => {
    const res = await api.get('/owner/categories');
    return res.data.data || res.data;
  },
  createOwnerCategory: async (data: { name: string; description?: string; sortOrder?: number }): Promise<any> => {
    const res = await api.post('/owner/categories', data);
    return res.data.data;
  },
  updateOwnerCategory: async (id: string, data: { name?: string; description?: string; sortOrder?: number }): Promise<any> => {
    const res = await api.put(`/owner/categories/${id}`, data);
    return res.data.data;
  },
  deleteOwnerCategory: async (id: string): Promise<void> => {
    await api.delete(`/owner/categories/${id}`);
  },
};

export default menuService;
