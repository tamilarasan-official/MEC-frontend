import api from './api';
import { ChangelogEntry } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

const changelogService = {
  getAll: async (): Promise<ChangelogEntry[]> => {
    const res = await api.get<ApiResponse<ChangelogEntry[]>>('/changelog');
    return res.data?.data ?? [];
  },

  getLatest: async (): Promise<ChangelogEntry | null> => {
    const res = await api.get<ApiResponse<ChangelogEntry>>('/changelog/latest');
    return res.data?.data ?? null;
  },
};

export default changelogService;
