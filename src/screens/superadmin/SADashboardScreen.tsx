import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector } from '../../store';
import { getDashboardStats } from '../../services/superadminService';
import { SuperAdminDashboardStats } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';

export default function SADashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAppSelector(s => s.auth.user);
  const [stats, setStats] = useState<SuperAdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  if (loading) {
    return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></ScreenWrapper>;
  }

  const cards = [
    { label: 'Monthly Revenue', value: `₹${(stats?.monthlyRevenue || 0).toLocaleString()}`, icon: 'trending-up', color: '#10b981' },
    { label: 'Monthly Profit', value: `₹${(stats?.monthlyProfit || 0).toLocaleString()}`, icon: 'cash-outline', color: '#6366f1' },
    { label: 'Total Orders', value: String(stats?.totalOrders || 0), icon: 'receipt-outline', color: '#f59e0b' },
    { label: 'Total Students', value: String(stats?.totalStudents || 0), icon: 'people-outline', color: '#3b82f6' },
  ];

  const systemCards = [
    { label: 'Active Shops', value: `${stats?.activeShops || 0} / ${stats?.totalShops || 0}`, icon: 'storefront-outline' },
    { label: 'Menu Items', value: String(stats?.totalMenuItems || 0), icon: 'fast-food-outline' },
    { label: 'Transactions', value: String(stats?.totalTransactions || 0), icon: 'swap-horizontal-outline' },
  ];

  return (
    <ScreenWrapper>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <Text style={styles.welcome}>Welcome back, {user?.name?.split(' ')[0] || 'Admin'} 👋</Text>
      <Text style={styles.subtitle}>Super Admin Dashboard</Text>

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

      <Text style={styles.sectionTitle}>System Overview</Text>
      <View style={styles.systemRow}>
        {systemCards.map(c => (
          <View key={c.label} style={styles.systemCard}>
            <Icon name={c.icon} size={20} color={colors.primary} />
            <Text style={styles.systemValue}>{c.value}</Text>
            <Text style={styles.systemLabel}>{c.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  welcome: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%', backgroundColor: colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  cardLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 28, marginBottom: 12 },
  systemRow: { flexDirection: 'row', gap: 10 },
  systemCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 6,
  },
  systemValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  systemLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
