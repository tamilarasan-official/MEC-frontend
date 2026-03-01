import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState, AppDispatch } from '../../store';
import { fetchDashboardStats } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import orderService from '../../services/orderService';
import { Order } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import OwnerHeader from '../../components/owner/OwnerHeader';
import OwnerProfileDropdown from '../../components/owner/OwnerProfileDropdown';
import OwnerWalletModal from '../../components/owner/OwnerWalletModal';

export default function OwnerHistoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const dashboardStats = useSelector((s: RootState) => s.user.dashboardStats);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showWallet, setShowWallet] = useState(false);

  useEffect(() => { if (!dashboardStats) dispatch(fetchDashboardStats()); }, [dashboardStats, dispatch]);

  const fetchData = useCallback(async () => {
    try {
      const historyResult = await orderService.getOrderHistory?.();
      const data = historyResult
        ? [...(historyResult.completed || []), ...(historyResult.cancelled || [])]
        : await orderService.getShopOrders();
      // Sort newest first
      const sorted = (data || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setOrders(sorted);
    } catch {
      console.error('Failed to fetch history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Filter by search query
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(o =>
      o.pickupToken?.toLowerCase().includes(q) ||
      o.orderNumber?.toString().includes(q) ||
      o.userName?.toLowerCase().includes(q),
    );
  }, [orders, searchQuery]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      month: 'short', day: 'numeric',
    }) + ', ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const getItemsSummary = (order: Order) => {
    if (!order.items?.length) return 'No items';
    return order.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return { label: 'Delivered', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: 'checkmark-circle' as const };
      case 'cancelled':
      case 'rejected':
        return { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: 'close-circle' as const };
      default:
        return { label: status, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: 'ellipse' as const };
    }
  };

  const getCompletionDuration = (order: Order) => {
    if (!order.completedAt || !order.createdAt) return null;
    const start = new Date(order.createdAt).getTime();
    const end = new Date(order.completedAt).getTime();
    const diffMs = end - start;
    if (diffMs <= 0) return null;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return '< 1 min';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
  };

  const renderOrder = useCallback(({ item: order }: { item: Order }) => {
    const status = getStatusInfo(order.status);
    const token = order.orderNumber || order.pickupToken || order.id?.slice(-4) || '—';
    const duration = getCompletionDuration(order);

    return (
      <View style={styles.orderCard}>
        {/* Top row: icon + order# + date | status badge */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.statusIcon, { backgroundColor: status.bg }]}>
              <Icon name={status.icon} size={20} color={status.color} />
            </View>
            <View>
              <Text style={styles.tokenText}>#{token}</Text>
              <Text style={styles.dateText}>{order.createdAt ? formatDate(order.createdAt) : ''}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Icon name={status.icon} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Customer */}
        <View style={styles.customerRow}>
          <Icon name="person-outline" size={14} color={colors.mutedForeground} />
          <Text style={styles.customerText}>{order.userName || 'Unknown'}</Text>
        </View>

        {/* Items summary */}
        <Text style={styles.itemsSummary} numberOfLines={2}>{getItemsSummary(order)}</Text>

        {/* Bottom row: total + completion time */}
        <View style={styles.bottomRow}>
          <View style={styles.totalWrap}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Rs. {order.total}</Text>
          </View>
          {duration && (
            <View style={styles.durationWrap}>
              <Icon name="time-outline" size={12} color={colors.mutedForeground} />
              <Text style={styles.durationText}>{duration}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }, [styles, colors]);

  if (loading) {
    return (
      <ScreenWrapper>
        <OwnerHeader
          searchQuery="" onSearchChange={() => {}} showSearch={false}
          onToggleSearch={() => {}} onProfilePress={() => setShowProfile(true)}
          todayRevenue={dashboardStats?.todayRevenue ?? 0}
          onAnalyticsPress={() => navigation.navigate('Analytics')}
          onRevenuePress={() => setShowWallet(true)}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <OwnerHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showSearch={showSearch}
          onToggleSearch={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }}
          onProfilePress={() => setShowProfile(true)}
          todayRevenue={dashboardStats?.todayRevenue ?? 0}
          onAnalyticsPress={() => navigation.navigate('Analytics')}
          onRevenuePress={() => setShowWallet(true)}
        />

        {/* Order count + refresh */}
        <View style={styles.countRow}>
          <Text style={styles.countText}>{filtered.length} orders</Text>
          <TouchableOpacity onPress={onRefresh} activeOpacity={0.7} style={styles.refreshBtn}>
            <Icon name="refresh" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Order list */}
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => item.id || String(index)}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="document-text-outline" size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptySubtitle}>Past orders will appear here</Text>
            </View>
          }
        />

        {/* Profile Dropdown & Wallet */}
        <OwnerProfileDropdown visible={showProfile} onClose={() => setShowProfile(false)} onOpenWallet={() => setShowWallet(true)} />
        <OwnerWalletModal visible={showWallet} onClose={() => setShowWallet(false)} />
      </View>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Count row
  countRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10,
  },
  countText: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    justifyContent: 'center', alignItems: 'center',
  },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  // Order card
  orderCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  cardTopLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  statusIcon: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  tokenText: { fontSize: 17, fontWeight: '800', color: colors.foreground },
  dateText: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Customer
  customerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  customerText: {
    fontSize: 14, color: colors.mutedForeground,
  },

  // Items summary
  itemsSummary: {
    fontSize: 14, fontWeight: '600', color: colors.foreground,
    marginBottom: 14, lineHeight: 20,
  },

  // Bottom row
  bottomRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalLabel: { fontSize: 14, color: colors.mutedForeground },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#10b981' },
  durationWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  durationText: { fontSize: 12, color: colors.mutedForeground },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  emptySubtitle: { fontSize: 13, color: colors.mutedForeground },
});
