import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchActiveShopOrders } from '../../store/slices/ordersSlice';
import { fetchDashboardStats } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { statusColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';

export default function CaptainHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const shopOrders = useSelector((s: RootState) => s.orders.shopOrders);
  const dashboardStats = useSelector((s: RootState) => s.user.dashboardStats);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      await Promise.all([
        dispatch(fetchActiveShopOrders()),
        dispatch(fetchDashboardStats()),
      ]);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const activeOrders = shopOrders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const pendingCount = activeOrders.filter(o => o.status === 'pending').length;
  const preparingCount = activeOrders.filter(o => o.status === 'preparing').length;
  const readyCount = activeOrders.filter(o => o.status === 'ready').length;
  const inProgressCount = pendingCount + preparingCount + readyCount;
  const completedToday = dashboardStats?.completedToday ?? 0;
  const cancelledToday = dashboardStats?.cancelledToday ?? 0;
  const totalOrders = inProgressCount + completedToday + cancelledToday;

  if (loading) {
    return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Greeting */}
      <Text style={styles.greetHi}>Good {getTimeOfDay()},</Text>
      <Text style={styles.greetName}>{user?.name || 'Captain'} 👋</Text>

      {/* Shop Status Banner */}
      <View style={styles.shopBanner}>
        <View style={[styles.shopStatusDot, { backgroundColor: colors.primary }]} />
        <Text style={styles.shopBannerText}>
          {user?.shopName || 'Your Shop'} • Active
        </Text>
      </View>

      {/* Today's Overview Card */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewTitle}>TODAY'S OVERVIEW</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Icon name="refresh" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <StatItem value={inProgressCount} label="In Progress" color={colors.blue[500]} styles={styles} />
          <StatItem value={completedToday} label="Completed" color={colors.primary} styles={styles} />
          <StatItem value={cancelledToday} label="Rejected" color={colors.destructive} styles={styles} />
          <StatItem value={totalOrders} label="Total" color={colors.foreground} styles={styles} />
        </View>
      </View>

      {/* Active Orders Preview */}
      {activeOrders.length > 0 && (
        <View style={styles.activeOrdersSection}>
          <Text style={styles.sectionTitle}>ACTIVE ORDERS</Text>
          {activeOrders.slice(0, 5).map(order => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderTop}>
                <Text style={styles.orderToken}>#{order.pickupToken}</Text>
                <View style={[styles.orderStatusBadge, { backgroundColor: statusColors[order.status]?.bg || colors.warningBg }]}>
                  <Text style={[styles.orderStatusText, { color: statusColors[order.status]?.text || colors.amber[500] }]}>
                    {statusColors[order.status]?.label || order.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.orderCustomer}>{order.userName}</Text>
              <Text style={styles.orderItems}>
                {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
              </Text>
              <View style={styles.orderBottom}>
                <Text style={styles.orderTotal}>Rs.{order.total}</Text>
                <Text style={styles.orderTime}>
                  {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {activeOrders.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="checkmark-circle" size={48} color={colors.primary} />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>No active orders right now</Text>
        </View>
      )}
      <View style={styles.bottomSpacer} />
    </ScrollView>
    </ScreenWrapper>
  );
}

function StatItem({ value, label, color, styles }: { value: number; label: string; color: string; styles: any }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greetHi: { fontSize: 14, color: colors.mutedForeground },
  greetName: { fontSize: 24, fontWeight: '800', color: colors.foreground, marginBottom: 16 },
  shopBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 14, backgroundColor: colors.successBg,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', marginBottom: 20,
  },
  shopStatusDot: { width: 8, height: 8, borderRadius: 4 },
  shopBannerText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  overviewCard: {
    borderRadius: 20, padding: 20,
    backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
  },
  overviewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  overviewTitle: {
    fontSize: 11, fontWeight: '700', color: colors.mutedForeground, letterSpacing: 1.5,
  },
  refreshBtn: { padding: 6, borderRadius: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.mutedForeground, marginTop: 2 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.mutedForeground,
    letterSpacing: 1.5, marginBottom: 12,
  },
  orderCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  orderTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  orderToken: { fontSize: 18, fontWeight: '800', color: colors.foreground, fontFamily: 'monospace' },
  orderStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  orderStatusText: { fontSize: 11, fontWeight: '700' },
  orderCustomer: { fontSize: 13, fontWeight: '500', color: colors.foreground, marginBottom: 4 },
  orderItems: { fontSize: 12, color: colors.mutedForeground, marginBottom: 8 },
  orderBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTotal: { fontSize: 14, fontWeight: '700', color: colors.primary },
  orderTime: { fontSize: 11, color: colors.mutedForeground },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  emptySubtitle: { fontSize: 13, color: colors.mutedForeground },
  activeOrdersSection: { marginTop: 20 },
  bottomSpacer: { height: 100 },
});
