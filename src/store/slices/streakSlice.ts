import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { MonthlySummary, LeaderboardPreview, WeeklyChallenge } from '../../types';
import streakService from '../../services/streakService';

interface StreakState {
  summary: MonthlySummary | null;
  leaderboardPreview: LeaderboardPreview | null;
  weeklyChallenge: WeeklyChallenge | null;
  selectedMonth: number;
  selectedYear: number;
  loading: boolean;
  leaderboardLoading: boolean;
  weeklyLoading: boolean;
  weeklyClaimLoading: boolean;
  error: string | null;
}

const now = new Date();

const initialState: StreakState = {
  summary: null,
  leaderboardPreview: null,
  weeklyChallenge: null,
  selectedMonth: now.getMonth() + 1,
  selectedYear: now.getFullYear(),
  loading: false,
  leaderboardLoading: false,
  weeklyLoading: false,
  weeklyClaimLoading: false,
  error: null,
};

export const fetchMonthlySummary = createAsyncThunk(
  'streak/fetchMonthlySummary',
  async ({ month, year }: { month: number; year: number }, { rejectWithValue }) => {
    try {
      return await streakService.getMonthlySummary(month, year);
    } catch (e: any) {
      if (__DEV__) console.error('[fetchMonthlySummary]', e.response?.status, e.response?.data);
      return rejectWithValue('Could not load streak data. Pull down to retry.');
    }
  }
);

export const fetchLeaderboardPreview = createAsyncThunk(
  'streak/fetchLeaderboardPreview',
  async (_, { rejectWithValue }) => {
    try {
      return await streakService.getLeaderboardPreview();
    } catch (e: any) {
      if (__DEV__) console.error('[fetchLeaderboardPreview]', e.response?.status, e.response?.data);
      return rejectWithValue('Could not load leaderboard.');
    }
  }
);

export const fetchWeeklyChallenge = createAsyncThunk(
  'streak/fetchWeeklyChallenge',
  async (_, { rejectWithValue }) => {
    try {
      return await streakService.getWeeklyChallenge();
    } catch (e: any) {
      if (__DEV__) console.error('[fetchWeeklyChallenge]', e.response?.status, e.response?.data);
      return rejectWithValue('Could not load weekly challenge.');
    }
  }
);

export const claimWeeklyChallenge = createAsyncThunk(
  'streak/claimWeeklyChallenge',
  async (_, { rejectWithValue }) => {
    try {
      return await streakService.claimWeeklyChallenge();
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.error?.message || e?.message || 'Could not claim badge.'
      );
    }
  }
);

const streakSlice = createSlice({
  name: 'streak',
  initialState,
  reducers: {
    setSelectedMonth(state, action: PayloadAction<{ month: number; year: number }>) {
      state.selectedMonth = action.payload.month;
      state.selectedYear = action.payload.year;
      // Clear stale data so previous month's heatmap doesn't flash while new data loads
      state.summary = null;
      state.loading = true;
    },
    resetStreakState: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchMonthlySummary.pending, s => { s.loading = true; s.error = null; })
      .addCase(fetchMonthlySummary.fulfilled, (s, a) => { s.loading = false; s.summary = a.payload; })
      .addCase(fetchMonthlySummary.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(fetchLeaderboardPreview.pending, s => { s.leaderboardLoading = true; })
      .addCase(fetchLeaderboardPreview.fulfilled, (s, a) => { s.leaderboardLoading = false; s.leaderboardPreview = a.payload; })
      .addCase(fetchLeaderboardPreview.rejected, s => { s.leaderboardLoading = false; })
      .addCase(fetchWeeklyChallenge.pending, s => { s.weeklyLoading = true; })
      .addCase(fetchWeeklyChallenge.fulfilled, (s, a) => { s.weeklyLoading = false; s.weeklyChallenge = a.payload; })
      .addCase(fetchWeeklyChallenge.rejected, s => { s.weeklyLoading = false; })
      .addCase(claimWeeklyChallenge.pending, s => { s.weeklyClaimLoading = true; })
      .addCase(claimWeeklyChallenge.fulfilled, (s, a) => {
        s.weeklyClaimLoading = false;
        if (s.weeklyChallenge) {
          s.weeklyChallenge.claimed = true;
          s.weeklyChallenge.isClaimable = false;
          s.weeklyChallenge.badge = a.payload.badge;
        }
      })
      .addCase(claimWeeklyChallenge.rejected, s => { s.weeklyClaimLoading = false; });
  },
});

export const { setSelectedMonth, resetStreakState } = streakSlice.actions;
export default streakSlice.reducer;
