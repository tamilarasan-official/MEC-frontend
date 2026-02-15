import api from './api';
import {
  SuperAdminDashboardStats,
  SuperAdminUser,
  Shop,
  PaymentRequest,
  LoginSession,
} from '../types';

// ---- Dashboard ----
export const getDashboardStats = async (): Promise<SuperAdminDashboardStats> => {
  const res = await api.get<{ success: boolean; data: SuperAdminDashboardStats }>('/superadmin/dashboard/stats');
  return res.data.data;
};

// ---- Users ----
interface GetUsersParams {
  search?: string;
  role?: string;
  department?: string;
  isApproved?: string;
  isActive?: string;
  page?: number;
  limit?: number;
}

export const getUsers = async (params: GetUsersParams = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.append(k, String(v));
  });
  const res = await api.get<{
    success: boolean;
    data: { users: SuperAdminUser[]; pagination: { page: number; totalPages: number; total: number } };
  }>(`/superadmin/users?${query}`);
  return res.data.data;
};

export const createUser = async (data: {
  username: string;
  password: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  rollNumber?: string;
  department?: string;
  year?: number;
  shopId?: string;
}) => {
  const res = await api.post<{ success: boolean; data: SuperAdminUser }>('/superadmin/users/create', data);
  return res.data.data;
};

export const updateUserRole = async (userId: string, role: string, shopId?: string) => {
  const res = await api.put(`/superadmin/users/${userId}/role`, { role, shopId });
  return res.data;
};

export const deactivateUser = async (userId: string) => {
  const res = await api.put(`/superadmin/users/${userId}/deactivate`);
  return res.data;
};

export const reactivateUser = async (userId: string) => {
  const res = await api.put(`/superadmin/users/${userId}/reactivate`);
  return res.data;
};

export const toggleAdhocPrivilege = async (userId: string) => {
  const res = await api.put(`/superadmin/users/${userId}/toggle-adhoc`);
  return res.data;
};

// ---- Shops ----
export const getShops = async (): Promise<Shop[]> => {
  const res = await api.get<{ success: boolean; data: Shop[] | { shops: Shop[] } }>('/shops');
  const d = res.data.data;
  return Array.isArray(d) ? d : d.shops;
};

export const createShop = async (data: {
  name: string;
  description?: string;
  category: string;
  contactPhone?: string;
  ownerDetails?: { name: string; email?: string; password: string; phone?: string };
}) => {
  const res = await api.post('/superadmin/shops', data);
  return res.data;
};

export const updateShop = async (shopId: string, data: Record<string, unknown>) => {
  const res = await api.put(`/superadmin/shops/${shopId}`, data);
  return res.data;
};

export const deleteShop = async (shopId: string) => {
  const res = await api.delete(`/superadmin/shops/${shopId}`);
  return res.data;
};

export const toggleShopStatus = async (shopId: string) => {
  const res = await api.patch(`/superadmin/shops/${shopId}/toggle`);
  return res.data;
};

export const toggleShopQR = async (shopId: string) => {
  const res = await api.patch(`/superadmin/shops/${shopId}/toggle-qr`);
  return res.data;
};

// ---- Payment Requests ----
export const getPaymentRequests = async (params: { status?: string; page?: number; limit?: number } = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.append(k, String(v));
  });
  const res = await api.get<{
    success: boolean;
    data: { requests: PaymentRequest[]; pagination: { page: number; totalPages: number; total: number } };
  }>(`/superadmin/payments?${query}`);
  return res.data.data;
};

export const createPaymentRequest = async (data: {
  title: string;
  description: string;
  amount: number;
  dueDate: string;
  targetType: string;
  targetDepartment?: string;
  targetYear?: number;
  targetStudents?: string[];
  isVisibleOnDashboard?: boolean;
}) => {
  const res = await api.post('/superadmin/payments', data);
  return res.data;
};

export const closePaymentRequest = async (id: string, status: 'closed' | 'cancelled') => {
  const res = await api.post(`/superadmin/payments/${id}/close`, { status });
  return res.data;
};

export const sendPaymentReminders = async (id: string) => {
  const res = await api.post(`/superadmin/payments/${id}/remind`);
  return res.data;
};

// ---- Security Logs ----
export const getLoginSessions = async (params: { page?: number; limit?: number; userId?: string } = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.append(k, String(v));
  });
  const res = await api.get<{
    success: boolean;
    data: { sessions: LoginSession[]; pagination: { page: number; totalPages: number; total: number } };
  }>(`/auth/sessions?${query}`);
  return res.data.data;
};

// ---- Diagnostics ----
export const diagnoseOwnerShopLinks = async () => {
  const res = await api.get('/superadmin/diagnose/owner-shop');
  return res.data;
};

export const linkOwnerToShop = async (ownerId: string, shopId: string) => {
  const res = await api.post('/superadmin/fix/owner-shop', { ownerId, shopId });
  return res.data;
};

// ---- Orders ----
export const getSuperadminOrders = async (params: {
  status?: string;
  shopId?: string;
  userId?: string;
  page?: number;
  limit?: number;
} = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.append(k, String(v));
  });
  const res = await api.get(`/superadmin/orders?${query}`);
  return res.data.data;
};

export const getSuperadminOrderStats = async () => {
  const res = await api.get('/superadmin/orders/stats');
  return res.data.data;
};

// ---- User Password Reset ----
export const resetUserPassword = async (userId: string, newPassword: string) => {
  const res = await api.post(`/superadmin/users/${userId}/reset-password`, { newPassword });
  return res.data;
};
