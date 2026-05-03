import api from './api';
import { MonthlySummary, LeaderboardPreview } from '../types';

const streakService = {
  getMonthlySummary: async (month: number, year: number): Promise<MonthlySummary> => {
    const res = await api.get('/student/streak/summary', { params: { month, year } });
    return res.data.data as MonthlySummary;
  },

  getLeaderboardPreview: async (): Promise<LeaderboardPreview> => {
    const res = await api.get('/student/streak/leaderboard-preview');
    return res.data.data as LeaderboardPreview;
  },
};

export default streakService;
