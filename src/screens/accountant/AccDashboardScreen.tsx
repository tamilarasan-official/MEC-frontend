import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector } from '../../store';
import * as accountantService from '../../services/accountantService';
import { AccountantDashboardStats, Transaction } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';

export default function AccDashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAppSelector(s => s.auth.user);
  const [stats, setStats] = useState<AccountantDashboardStats | null>(null);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dashStats, txnData] = await Promise.all([
        accountantService.getDashboardStats(),
        accountantService.getTransactions({ limit: 10 }),
      ]);
      setStats(dashStats);
      setRecentTxns(txnData.transactions || []);
    } catch { } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></ScreenWrapper>;

  const cards = [
    { label: 'Total Students', value: String(stats?.totalStudents ?? 0), icon: 'people-outline', color: '#3b82f6' },
    { label: 'Total Balance', value: `₹${(stats?.totalBalance ?? 0).toLocaleString()}`, icon: 'wallet-outline', color: '#10b981' },
    { label: 'Today Credits', value: `₹${(stats?.todayCredits ?? 0).toLocaleString()}`, icon: 'trending-up', color: '#f59e0b' },
    { label: "Today's Txns", value: String(stats?.todayTransactions ?? 0), icon: 'swap-horizontal-outline', color: '#8b5cf6' },
  ];

  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>

      <Text style={styles.greeting}>Welcome, {user?.name?.split(' ')[0]}!</Text>
      <Text style={styles.subtitle}>Accountant Dashboard</Text>

      <View style={styles.grid}>
        {cards.map(c => (
          <View key={c.label} style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: c.color + '20' }]}>
              <Icon name={c.icon} size={22} color={c.color} />
            </View>
            <Text style={styles.cardValue}>{c.value}</Text>
            <Text style={styles.cardLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Monthly Overview</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Month Recharges</Text>
          <Text style={styles.summaryValue}>₹{(stats?.monthRecharges ?? 0).toLocaleString()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Pending Approvals</Text>
          <Text style={[styles.summaryValue, styles.summaryValueWarning]}>{stats?.pendingApprovals ?? 0}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {recentTxns.length === 0 ? (
        <Text style={styles.emptyText}>No transactions yet</Text>
      ) : (
        recentTxns.map(txn => (
          <View key={txn.id} style={styles.txnRow}>
            <View style={[styles.txnIcon, txn.type === 'credit' ? styles.txnIconCredit : styles.txnIconDebit]}>
              <Icon name={txn.type === 'credit' ? 'arrow-down' : 'arrow-up'} size={16}
                color={txn.type === 'credit' ? '#16a34a' : '#ef4444'} />
            </View>
            <View style={styles.txnInfo}>
              <Text style={styles.txnDesc} numberOfLines={1}>{txn.description || txn.type}</Text>
              <Text style={styles.txnTime}>{new Date(txn.createdAt).toLocaleString()}</Text>
            </View>
            <Text style={[styles.txnAmount, txn.type === 'credit' ? styles.txnAmountCredit : styles.txnAmountDebit]}>
              {txn.type === 'credit' ? '+' : '-'}₹{txn.amount}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: { width: '48%' as any, backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  cardValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  cardLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  summaryCard: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryLabel: { fontSize: 14, color: colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  summaryValueWarning: { color: '#f59e0b' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 20 },
  txnRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  txnIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  txnIconCredit: { backgroundColor: '#dcfce7' },
  txnIconDebit: { backgroundColor: '#fef2f2' },
  txnInfo: { flex: 1, marginLeft: 12 },
  txnDesc: { fontSize: 14, fontWeight: '600', color: colors.text },
  txnTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700' },
  txnAmountCredit: { color: '#16a34a' },
  txnAmountDebit: { color: '#ef4444' },
});
