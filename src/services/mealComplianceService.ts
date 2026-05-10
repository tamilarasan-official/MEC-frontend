import api from './api';

export type MealSessionType = 'breakfast' | 'lunch' | 'dinner';
export type MealComplianceStatus = 'pending' | 'eaten' | 'missed' | 'debited' | 'exempted' | 'holiday_locked' | 'refunded';

export interface MealComplianceTodaySession {
  sessionType: MealSessionType;
  status: MealComplianceStatus;
  amount?: number;
  startTime: string;
  endTime: string;
  linkedShopId?: string;
}

export interface MealComplianceTodayResponse {
  date: string;
  holiday?: {
    name: string;
    startDate: string;
    endDate: string;
    reason?: string;
    announcementMessage?: string;
  } | null;
  sessions: MealComplianceTodaySession[];
}

export interface MealComplianceHistoryRecord {
  id: string;
  date: string;
  sessionType: MealSessionType;
  status: 'debited' | 'refunded' | 'exempted';
  officialFoodNameSnapshot: string;
  officialAmountSnapshot: number;
  debitAmount?: number;
  exemptReason?: string;
}

const mealComplianceService = {
  async getToday(): Promise<MealComplianceTodayResponse> {
    const res = await api.get('/student/meal-compliance/today');
    return res.data.data;
  },

  async getHistory(page = 1, limit = 50): Promise<MealComplianceHistoryRecord[]> {
    const res = await api.get('/student/meal-compliance/history', { params: { page, limit } });
    const raw = res.data.data?.records || res.data.data || [];
    return (Array.isArray(raw) ? raw : []).map((record: any) => ({
      ...record,
      id: record.id || record._id || '',
    }));
  },

  async getActiveHoliday(): Promise<MealComplianceTodayResponse['holiday']> {
    const res = await api.get('/student/holidays/active');
    return res.data.data || null;
  },
};

export default mealComplianceService;
