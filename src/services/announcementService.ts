import api from './api';
import { Announcement } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

const announcementService = {
  getActive: async (): Promise<Announcement[]> => {
    const res = await api.get<ApiResponse<{ announcements: Announcement[] }>>('/announcements/active');
    return res.data?.data?.announcements ?? [];
  },
};

export default announcementService;
