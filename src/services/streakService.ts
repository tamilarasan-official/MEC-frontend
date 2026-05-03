import api from './api';
import { MonthlySummary, LeaderboardPreview, WeeklyChallenge } from '../types';

const streakService = {
  getMonthlySummary: async (month: number, year: number): Promise<MonthlySummary> => {
    const res = await api.get('/student/streak/summary', { params: { month, year } });
    return res.data.data as MonthlySummary;
  },

  getLeaderboardPreview: async (): Promise<LeaderboardPreview> => {
    const res = await api.get('/student/streak/leaderboard-preview');
    return res.data.data as LeaderboardPreview;
  },

  getWeeklyChallenge: async (): Promise<WeeklyChallenge> => {
    const res = await api.get('/student/streak/weekly-challenge');
    return res.data.data as WeeklyChallenge;
  },

  claimWeeklyChallenge: async (): Promise<{ badge: { weekStart: string; claimedAt: string } }> => {
    const res = await api.post('/student/streak/weekly-challenge/claim');
    return res.data.data;
  },
};

export default streakService;
