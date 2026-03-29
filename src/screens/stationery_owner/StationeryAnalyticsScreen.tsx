import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchQRPayments, fetchWalletBalance } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { QRPayment } from '../../types';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All' },
];

function isWithinFilter(dateStr: string, filter: TimeFilter): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  switch (filter) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return d >= start;
    }
    case 'week': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= start;
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= start;
    }
    case 'all':
    default:
      return true;
  }
}

export default function StationeryAnalyticsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const qrPayments = useAppSelector(s => s.user.qrPayments);
  const balance = useAppSelector(s => s.user.balance);
  const [refreshing, setRefreshing] = useState(false);
  const [revenueFilter, setRevenueFilter] = useState<TimeFilter>('month');
  const [paymentFilter, setPaymentFilter] = useState<TimeFilter>('month');

  useEffect(() => { dispatch(fetchQRPayments()); }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([dispatch(fetchQRPayments()), dispatch(fetchWalletBalance())]);
    setRefreshing(false);
  }, [dispatch]);

  // All paid transactions flattened
  const allTransactions = useMemo(() => {
    const items: { title: string; studentName: string; amount: number; paidAt: string }[] = [];
    for (const p of qrPayments) {
      for (const payer of (p.payers || [])) {
        items.push({ title: p.title, studentName: payer.studentName, amount: payer.amount, paidAt: payer.paidAt });
      }
    }
    return items;
  }, [qrPayments]);

  // Revenue by filter
  const getRevenue = (filter: TimeFilter) =>
    allTransactions.filter(t => isWithinFilter(t.paidAt, filter)).reduce((sum, t) => sum + t.amount, 0);

  // Payment count by filter
  const getPaymentCount = (filter: TimeFilter) =>
    allTransactions.filter(t => isWithinFilter(t.paidAt, filter)).length;

  // Overall stats
  const totalRevenue = allTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalPayments = allTransactions.length;
  const totalQRCreated = qrPayments.length;
  const activeQR = qrPayments.filter(p => p.status === 'active').length;
  const closedQR = qrPayments.filter(p => p.status !== 'active').length;
  const avgPaymentAmount = totalPayments > 0 ? Math.round(totalRevenue / totalPayments) : 0;

  // Top payers
  const topPayers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const t of allTransactions) {
      const existing = map.get(t.studentName);
      if (existing) {
        existing.total += t.amount;
        existing.count += 1;
      } else {
        map.set(t.studentName, { name: t.studentName, total: t.amount, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [allTransactions]);

  // Daily revenue for last 7 days
  const dailyRevenue = useMemo(() => {
    const days: { label: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const amount = allTransactions
        .filter(t => {
          const td = new Date(t.paidAt);
          return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate();
        })
        .reduce((sum, t) => sum + t.amount, 0);
      days.push({ label: dayLabel, amount });
    }
    return days;
  }, [allTransactions]);

  const maxDailyRevenue = Math.max(...dailyRevenue.map(d => d.amount), 1);

  // Recent transactions
  const recentTransactions = useMemo(() =>
    [...allTransactions].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()).slice(0, 5),
  [allTransactions]);

  return (
    <ScreenWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Title */}
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>QR Payment Performance</Text>

        {/* Revenue Card */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueHeader}>
            <View>
              <Text style={styles.revenueLabel}>Revenue</Text>
              <Text style={styles.revenueAmount}>Rs. {getRevenue(revenueFilter).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.revenueIcon}>
              <Icon name="trending-up" size={24} color="#10b981" />
            </View>
          </View>
          <View style={styles.filterRow}>
            {TIME_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterBtn, revenueFilter === f.key && styles.filterBtnActive]}
                onPress={() => setRevenueFilter(f.key)}>
                <Text style={[styles.filterText, revenueFilter === f.key && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Payments Count Card */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payments</Text>
          </View>
          <Text style={styles.bigValue}>{getPaymentCount(paymentFilter)}</Text>
          <View style={styles.filterRow}>
            {TIME_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterBtn, paymentFilter === f.key && styles.filterBtnActive]}
                onPress={() => setPaymentFilter(f.key)}>
                <Text style={[styles.filterText, paymentFilter === f.key && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Icon name="qr-code-outline" size={22} color="#8b5cf6" />
            <Text style={styles.metricValue}>{totalQRCreated}</Text>
            <Text style={styles.metricLabel}>QR Created</Text>
          </View>
          <View style={styles.metricCard}>
            <Icon name="checkmark-done-circle" size={22} color="#10b981" />
            <Text style={styles.metricValue}>{closedQR}</Text>
            <Text style={styles.metricLabel}>Paid</Text>
          </View>
          <View style={styles.metricCard}>
            <Icon name="time-outline" size={22} color="#3b82f6" />
            <Text style={styles.metricValue}>{activeQR}</Text>
            <Text style={styles.metricLabel}>Active</Text>
          </View>
          <View style={styles.metricCard}>
            <Icon name="cash-outline" size={22} color="#f59e0b" />
            <Text style={styles.metricValue}>Rs.{avgPaymentAmount}</Text>
            <Text style={styles.metricLabel}>Avg Amount</Text>
          </View>
        </View>

        {/* 7-Day Bar Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
          <View style={styles.barChart}>
            {dailyRevenue.map((day, i) => (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${Math.max((day.amount / maxDailyRevenue) * 100, 4)}%` }]} />
                </View>
                <Text style={styles.barLabel}>{day.label}</Text>
                {day.amount > 0 && <Text style={styles.barAmount}>₹{day.amount}</Text>}
              </View>
            ))}
          </View>
        </View>

        {/* Top Payers */}
        {topPayers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Customers</Text>
            {topPayers.map((payer, i) => (
              <View key={payer.name} style={styles.payerRow}>
                <View style={[styles.rankBadge, { backgroundColor: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : colors.border }]}>
                  <Text style={styles.rankText}>{i + 1}</Text>
                </View>
                <View style={styles.payerInfo}>
                  <Text style={styles.payerName}>{payer.name}</Text>
                  <Text style={styles.payerCount}>{payer.count} payment{payer.count !== 1 ? 's' : ''}</Text>
                </View>
                <Text style={styles.payerTotal}>Rs. {payer.total}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            {recentTransactions.map((tx, i) => (
              <View key={`${tx.paidAt}-${i}`} style={styles.recentRow}>
                <View style={styles.recentIcon}>
                  <Icon name="receipt-outline" size={16} color="#10b981" />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentTitle} numberOfLines={1}>{tx.title}</Text>
                  <Text style={styles.recentSub}>{tx.studentName} · {new Date(tx.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <Text style={styles.recentAmount}>+Rs.{tx.amount}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Wallet Balance */}
        <View style={[styles.section, { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="wallet-outline" size={22} color="#10b981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>Wallet Balance</Text>
              <Text style={[styles.bigValue, { color: '#10b981' }]}>Rs. {balance}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16 },

  title: { fontSize: 24, fontWeight: '900', color: c.foreground, marginBottom: 2 },
  subtitle: { fontSize: 13, color: c.mutedForeground, marginBottom: 20 },

  // Revenue card
  revenueCard: {
    backgroundColor: c.card, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: c.border, marginBottom: 14,
  },
  revenueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  revenueLabel: { fontSize: 13, fontWeight: '600', color: c.mutedForeground, marginBottom: 4 },
  revenueAmount: { fontSize: 32, fontWeight: '900', color: c.foreground },
  revenueIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.12)', justifyContent: 'center', alignItems: 'center',
  },

  // Section
  section: {
    backgroundColor: c.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 14,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: c.foreground, marginBottom: 10 },
  bigValue: { fontSize: 28, fontWeight: '900', color: c.foreground, marginBottom: 10 },

  // Filters
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: c.background, borderWidth: 1, borderColor: c.border,
  },
  filterBtnActive: { backgroundColor: c.accent + '20', borderColor: c.accent },
  filterText: { fontSize: 12, fontWeight: '600', color: c.mutedForeground },
  filterTextActive: { color: c.accent },

  // Metrics grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 14 },
  metricCard: {
    width: '48%', backgroundColor: c.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: c.border, alignItems: 'center', marginBottom: 10,
  },
  metricValue: { fontSize: 20, fontWeight: '800', color: c.foreground },
  metricLabel: { fontSize: 11, color: c.mutedForeground, textAlign: 'center' },

  // Bar chart
  barChart: { flexDirection: 'row', justifyContent: 'space-between', height: 120, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: {
    width: '70%', height: '80%', backgroundColor: c.border, borderRadius: 6,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: c.accent, borderRadius: 6 },
  barLabel: { fontSize: 10, color: c.mutedForeground, marginTop: 4 },
  barAmount: { fontSize: 8, color: c.accent, fontWeight: '700' },

  // Top payers
  payerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rankBadge: {
    width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center',
  },
  rankText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  payerInfo: { flex: 1 },
  payerName: { fontSize: 14, fontWeight: '600', color: c.foreground },
  payerCount: { fontSize: 11, color: c.mutedForeground },
  payerTotal: { fontSize: 15, fontWeight: '700', color: '#10b981' },

  // Recent transactions
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  recentIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  recentInfo: { flex: 1 },
  recentTitle: { fontSize: 13, fontWeight: '600', color: c.foreground },
  recentSub: { fontSize: 11, color: c.mutedForeground, marginTop: 1 },
  recentAmount: { fontSize: 14, fontWeight: '700', color: '#10b981' },
});
