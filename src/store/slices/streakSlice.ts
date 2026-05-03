import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { MonthlySummary, LeaderboardPreview } from '../../types';
import streakService from '../../services/streakService';

interface StreakState {
  summary: MonthlySummary | null;
  leaderboardPreview: LeaderboardPreview | null;
  selectedMonth: number;
  selectedYear: number;
  loading: boolean;
  leaderboardLoading: boolean;
  error: string | null;
}

const now = new Date();

const initialState: StreakState = {
  summary: null,
  leaderboardPreview: null,
  selectedMonth: now.getMonth() + 1,
  selectedYear: now.getFullYear(),
  loading: false,
  leaderboardLoading: false,
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

const streakSlice = createSlice({
  name: 'streak',
  initialState,
  reducers: {
    setSelectedMonth(state, action: PayloadAction<{ month: number; year: number }>) {
      state.selectedMonth = action.payload.month;
      state.selectedYear = action.payload.year;
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
      .addCase(fetchLeaderboardPreview.rejected, s => { s.leaderboardLoading = false; });
  },
});

export const { setSelectedMonth, resetStreakState } = streakSlice.actions;
export default streakSlice.reducer;
