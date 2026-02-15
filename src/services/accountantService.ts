import api from './api';
import { User, StudentWithWallet, Transaction, VendorPayable } from '../types';

// ---- Students ----
export const getStudents = async (): Promise<User[]> => {
  const res = await api.get<{ success: boolean; data: User[] | { students: User[] } }>('/accountant/students');
  const d = res.data.data;
  return Array.isArray(d) ? d : d.students;
};

export const getStudentWithWallet = async (studentId: string): Promise<StudentWithWallet> => {
  const res = await api.get<{ success: boolean; data: StudentWithWallet }>(`/accountant/students/${studentId}`);
  return res.data.data;
};

// ---- Wallet Operations ----
const sourceMap: Record<string, string> = {
  cash: 'cash_deposit',
  online: 'online_payment',
  complementary: 'complementary',
  pg: 'pg_direct',
};

export const creditWallet = async (studentId: string, amount: number, source: string, description?: string) => {
  const res = await api.post(`/accountant/students/${studentId}/credit`, {
    amount,
    source: sourceMap[source] || source,
    description,
  });
  return res.data;
};

export const debitWallet = async (studentId: string, amount: number, description: string) => {
  const res = await api.post(`/accountant/students/${studentId}/debit`, { amount, description });
  return res.data;
};

// ---- Transactions ----
interface TransactionFilters {
  userId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const getTransactions = async (filters: TransactionFilters = {}) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.append(k, String(v));
  });
  const res = await api.get<{
    success: boolean;
    data: { transactions: Transaction[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
  }>(`/accountant/transactions?${query}`);
  return res.data.data;
};

// ---- Pending Approvals ----
export const getPendingApprovals = async (): Promise<User[]> => {
  const res = await api.get<{ success: boolean; data: User[] }>('/accountant/pending-approvals');
  return res.data.data;
};

export const approveUser = async (userId: string, initialBalance?: number) => {
  const res = await api.put(`/accountant/approve/${userId}`, { initialBalance });
  return res.data;
};

export const rejectUser = async (userId: string) => {
  const res = await api.put(`/accountant/reject/${userId}`);
  return res.data;
};

// ---- Dashboard Stats ----
export const getDashboardStats = async () => {
  const [students, transactions] = await Promise.all([
    getStudents(),
    getTransactions({ limit: 100 }),
  ]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const txns = transactions.transactions || [];
  const totalBalance = students.reduce((sum, s) => sum + (s.balance || 0), 0);
  const todayTxns = txns.filter((t: Transaction) => t.createdAt >= todayStart);
  const todayCredits = todayTxns
    .filter((t: Transaction) => t.type === 'credit')
    .reduce((sum: number, t: Transaction) => sum + t.amount, 0);
  const monthRecharges = txns
    .filter((t: Transaction) => t.type === 'credit' && t.createdAt >= monthStart)
    .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

  return {
    totalStudents: students.length,
    totalBalance,
    pendingApprovals: 0,
    monthRecharges,
    todayCredits,
    todayTransactions: todayTxns.length,
  };
};

// ---- Vendor Payables ----
export const getVendorPayables = async (period?: string) => {
  const query = period ? `?period=${period}` : '';
  const res = await api.get<{
    success: boolean;
    data: { payables: VendorPayable[]; period: string };
  }>(`/accountant/vendor-payables${query}`);
  return res.data.data;
};

export const updateVendorTransfer = async (
  shopId: string,
  period: string,
  amount: number,
  status: string,
  notes?: string,
) => {
  const res = await api.post('/accountant/vendor-transfers', {
    shopId,
    period,
    amount,
    status,
    notes,
  });
  return res.data;
};
