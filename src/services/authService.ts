import api, { clearTokens, getOrCreateDeviceId } from './api';
import { Platform } from 'react-native';
import { User, LoginResponse, RegisterData } from '../types';
import { getDeviceId } from '../store/slices/authSlice';

const authService = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const deviceId = await getOrCreateDeviceId();
    const res = await api.post('/auth/login', { username, password, deviceId, deviceInfo: { platform: Platform.OS } });
    return res.data.data;
  },
  sendOtp: async (phone: string): Promise<{ sessionId: string }> => {
    const res = await api.post('/auth/send-otp', { phone });
    return res.data.data;
  },
  verifyOtp: async (phone: string, otp: string, sessionId: string): Promise<LoginResponse> => {
    const deviceId = await getOrCreateDeviceId();
    const res = await api.post('/auth/verify-otp', { phone, sessionId, otp, deviceId });
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
    try {
      const deviceId = await getDeviceId();
      await api.post('/auth/logout', { deviceId });
    } catch {}
    await clearTokens();
  },
  refreshToken: async (refreshToken: string): Promise<LoginResponse> => {
    const res = await api.post('/auth/refresh', { refreshToken });
    return res.data.data;
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.put('/auth/change-password', { currentPassword, newPassword });
  },
};

export default authService;
