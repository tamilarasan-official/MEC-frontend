import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Switch,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchDashboardStats, fetchShopDetails, toggleShopStatus } from '../../store/slices/userSlice';
import { fetchActiveShopOrders } from '../../store/slices/ordersSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { statusColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';

export default function OwnerHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const dashboardStats = useSelector((s: RootState) => s.user.dashboardStats);
  const shopDetails = useSelector((s: RootState) => s.user.shopDetails);
  const shopOrders = useSelector((s: RootState) => s.orders.shopOrders);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      await Promise.all([
        dispatch(fetchDashboardStats()),
        dispatch(fetchShopDetails()),
        dispatch(fetchActiveShopOrders()),
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

  const handleToggleShop = () => {
    dispatch(toggleShopStatus());
  };

  const activeOrders = shopOrders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const todayRevenue = dashboardStats?.todayRevenue ?? 0;
  const completedToday = dashboardStats?.completedToday ?? 0;
  const cancelledToday = dashboardStats?.cancelledToday ?? 0;
  const pendingCount = activeOrders.filter(o => o.status === 'pending').length;
  const isShopOpen = shopDetails?.isActive ?? true;

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
      <Text style={styles.greetHi}>Welcome back,</Text>
      <Text style={styles.greetName}>{user?.name || 'Owner'} 👋</Text>

      {/* Shop Status Toggle */}
      <View style={[styles.shopToggle, { backgroundColor: isShopOpen ? colors.successBg : colors.errorBg }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={[styles.shopIcon, { backgroundColor: isShopOpen ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }]}>
            <Icon name="storefront-outline" size={22} color={isShopOpen ? colors.primary : colors.destructive} />
          </View>
          <View>
            <Text style={[styles.shopName, { color: isShopOpen ? colors.primary : colors.destructive }]}>
              {user?.shopName || 'My Shop'}
            </Text>
            <Text style={styles.shopStatus}>{isShopOpen ? 'Open for orders' : 'Closed'}</Text>
          </View>
        </View>
        <Switch
          value={isShopOpen}
          onValueChange={handleToggleShop}
          trackColor={{ false: colors.destructive, true: colors.primary }}
          thumbColor="#fff"
        />
      </View>

      {/* Revenue Card */}
      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>TODAY'S REVENUE</Text>
        <Text style={styles.revenueAmount}>Rs.{todayRevenue.toLocaleString()}</Text>
        <View style={styles.revenueStatsRow}>
          <View style={styles.revenueStat}>
            <Text style={[styles.revenueStatValue, { color: colors.primary }]}>{completedToday}</Text>
            <Text style={styles.revenueStatLabel}>Completed</Text>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueStat}>
            <Text style={[styles.revenueStatValue, { color: colors.amber[500] }]}>{pendingCount}</Text>
            <Text style={styles.revenueStatLabel}>Active</Text>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueStat}>
            <Text style={[styles.revenueStatValue, { color: colors.destructive }]}>{cancelledToday}</Text>
            <Text style={styles.revenueStatLabel}>Cancelled</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionCard}>
          <View style={[styles.actionIcon, { backgroundColor: colors.blueBg }]}>
            <Icon name="list-outline" size={22} color={colors.blue[500]} />
          </View>
          <Text style={styles.actionLabel}>Orders</Text>
          <Text style={styles.actionSub}>{activeOrders.length} active</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard}>
          <View style={[styles.actionIcon, { backgroundColor: colors.orangeBg }]}>
            <Icon name="restaurant-outline" size={22} color={colors.orange[500]} />
          </View>
          <Text style={styles.actionLabel}>Menu</Text>
          <Text style={styles.actionSub}>Manage items</Text>
        </TouchableOpacity>
      </View>

      {/* Active Orders Preview */}
      {activeOrders.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>ACTIVE ORDERS</Text>
          {activeOrders.slice(0, 3).map(order => {
            const sc = statusColors[order.status];
            return (
              <View key={order.id} style={styles.orderPreview}>
                <View style={styles.orderPreviewTop}>
                  <Text style={styles.orderToken}>#{order.pickupToken}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: sc?.bg || colors.warningBg }]}>
                    <Text style={[styles.statusTextSmall, { color: sc?.text || colors.amber[500] }]}>
                      {sc?.label || order.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.orderInfo}>
                  {order.userName} • {order.items.length} items • Rs.{order.total}
                </Text>
              </View>
            );
          })}
        </>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greetHi: { fontSize: 14, color: colors.mutedForeground },
  greetName: { fontSize: 24, fontWeight: '800', color: colors.foreground, marginBottom: 20 },
  shopToggle: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', marginBottom: 20,
  },
  shopIcon: {
    width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  shopName: { fontSize: 15, fontWeight: '700' },
  shopStatus: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  revenueCard: {
    backgroundColor: colors.card, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.border, marginBottom: 20,
  },
  revenueLabel: {
    fontSize: 11, fontWeight: '700', color: colors.mutedForeground, letterSpacing: 1.5, marginBottom: 4,
  },
  revenueAmount: { fontSize: 36, fontWeight: '900', color: colors.foreground },
  revenueStatsRow: {
    flexDirection: 'row', marginTop: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  revenueStat: { flex: 1, alignItems: 'center' },
  revenueStatValue: { fontSize: 20, fontWeight: '800' },
  revenueStatLabel: { fontSize: 10, color: colors.mutedForeground, marginTop: 2 },
  revenueDivider: { width: 1, backgroundColor: colors.border },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.mutedForeground,
    letterSpacing: 1.5, marginBottom: 12, marginTop: 4,
  },
  actionsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  actionIcon: {
    width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  actionLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  actionSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  orderPreview: {
    backgroundColor: colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  orderPreviewTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
  },
  orderToken: { fontSize: 16, fontWeight: '800', color: colors.foreground, fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusTextSmall: { fontSize: 10, fontWeight: '700' },
  orderInfo: { fontSize: 12, color: colors.mutedForeground },
});
