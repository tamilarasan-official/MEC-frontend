import api, { setTokens, clearTokens } from './api';
import { User, LoginResponse, RegisterData } from '../types';

const authService = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await api.post('/auth/login', { username, password, deviceId: `mobile-${Date.now()}`, deviceInfo: { platform: 'react-native' } });
    return res.data.data;
  },
  sendOtp: async (phone: string): Promise<void> => {
    await api.post('/auth/send-otp', { phone });
  },
  verifyOtp: async (phone: string, otp: string): Promise<LoginResponse> => {
    const res = await api.post('/auth/verify-otp', { phone, otp, deviceId: `mobile-${Date.now()}` });
    return res.data.data;
  },
  register: async (data: RegisterData): Promise<{ user: User; message: string }> => {
    const res = await api.post('/auth/register', data);
    return res.data.data;
  },
  getCurrentUser: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data.data?.user || res.data.data;
  },
  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    await clearTokens();
  },
  refreshToken: async (refreshToken: string): Promise<LoginResponse> => {
    const res = await api.post('/auth/refresh', { refreshToken });
    return res.data.data;
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },
};

export default authService;
