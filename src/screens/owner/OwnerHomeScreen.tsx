import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Image,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState, AppDispatch } from '../../store';
import { fetchActiveShopOrders, updateOrderStatus, markItemDelivered } from '../../store/slices/ordersSlice';
import { fetchDashboardStats, fetchShopDetails } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { statusColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import OwnerHeader from '../../components/owner/OwnerHeader';
import OwnerProfileDropdown from '../../components/owner/OwnerProfileDropdown';
import OwnerWalletModal from '../../components/owner/OwnerWalletModal';
import { Order, OrderStatus } from '../../types';

const IMAGE_BASE = 'https://backend.mec.welocalhost.com';
function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${IMAGE_BASE}${url}`;
}

type FilterKey = 'ready_serve' | 'pending' | 'preparing' | 'ready';

const FILTERS: { key: FilterKey; label: string; icon: string; color: string }[] = [
  { key: 'ready_serve', label: 'Ready to Serve', icon: 'flash', color: '#f97316' },
  { key: 'pending', label: 'New', icon: 'time-outline', color: '#3b82f6' },
  { key: 'preparing', label: 'Preparing', icon: 'restaurant-outline', color: '#3b82f6' },
  { key: 'ready', label: 'Ready', icon: 'cube-outline', color: '#3b82f6' },
];

export default function OwnerHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const shopOrders = useSelector((s: RootState) => s.orders.shopOrders);
  const dashboardStats = useSelector((s: RootState) => s.user.dashboardStats);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      await Promise.all([
        dispatch(fetchActiveShopOrders()),
        dispatch(fetchDashboardStats()),
        dispatch(fetchShopDetails()),
      ]);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => dispatch(fetchActiveShopOrders()), 5000);
    return () => clearInterval(interval);
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleRefreshStats = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  // Stats
  const activeOrders = shopOrders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const pendingCount = activeOrders.filter(o => o.status === 'pending').length;
  const preparingCount = activeOrders.filter(o => o.status === 'preparing').length;
  const readyCount = activeOrders.filter(o => o.status === 'ready').length;
  const readyServeCount = activeOrders.filter(o => o.isReadyServe && o.status === 'ready').length;
  const inProgressCount = pendingCount + preparingCount + readyCount;
  const completedToday = dashboardStats?.completedToday ?? 0;
  const cancelledToday = dashboardStats?.cancelledToday ?? 0;
  const totalOrders = inProgressCount + completedToday + cancelledToday;

  // Filter orders
  const getFilteredOrders = () => {
    let orders: Order[];
    if (filter === 'ready_serve') {
      orders = activeOrders.filter(o => o.isReadyServe && o.status === 'ready');
    } else {
      orders = activeOrders.filter(o => {
        if (o.isReadyServe && o.status === 'ready') return false;
        return o.status === filter;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      orders = orders.filter(o =>
        o.pickupToken?.toLowerCase().includes(q) ||
        o.orderNumber?.toLowerCase().includes(q)
      );
    }
    return orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const filteredOrders = getFilteredOrders();

  const getFilterCount = (key: FilterKey) => {
    if (key === 'ready_serve') return readyServeCount;
    if (key === 'ready') return activeOrders.filter(o => o.status === 'ready' && !o.isReadyServe).length;
    return activeOrders.filter(o => o.status === key).length;
  };

  // Actions
  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await dispatch(updateOrderStatus({ orderId, status: newStatus })).unwrap();
    } catch {
      Alert.alert('Error', 'Failed to update order status');
    }
    setUpdatingId(null);
  };

  const handleItemDelivered = async (orderId: string, itemIndex: number) => {
    try {
      await dispatch(markItemDelivered({ orderId, itemIndex })).unwrap();
    } catch {
      Alert.alert('Error', 'Failed to mark item delivered');
    }
  };

  const handleToggleSearch = () => {
    setShowSearch(!showSearch);
    if (showSearch) setSearchQuery('');
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      {/* Header */}
      <OwnerHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showSearch={showSearch}
        onToggleSearch={handleToggleSearch}
        onProfilePress={() => setShowProfile(true)}
        todayRevenue={dashboardStats?.todayRevenue ?? 0}
        onAnalyticsPress={() => navigation.navigate('Analytics')}
        onRevenuePress={() => setShowWallet(true)}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Today's Overview Card */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>TODAY'S OVERVIEW</Text>
            <TouchableOpacity onPress={handleRefreshStats} style={styles.refreshBtn} disabled={isRefreshing}>
              <Icon name="refresh" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={styles.statsRow}>
            <StatItem value={inProgressCount} label="In Progress" color={colors.blue[500]} styles={styles} />
            <StatItem value={completedToday} label="Completed" color={colors.accent} styles={styles} />
            <StatItem value={cancelledToday} label="Rejected" color={colors.destructive} styles={styles} />
            <StatItem value={totalOrders} label="Total" color={colors.foreground} styles={styles} />
          </View>
        </View>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(f => {
            const count = getFilterCount(f.key);
            const isActive = filter === f.key;
            const isOrange = f.key === 'ready_serve';
            const activeColor = isOrange ? '#f97316' : colors.accent;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterTab,
                  isActive && { backgroundColor: activeColor },
                ]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                <Icon
                  name={f.icon}
                  size={14}
                  color={isActive ? '#fff' : colors.mutedForeground}
                />
                <Text style={[
                  styles.filterLabel,
                  isActive && { color: '#fff' },
                ]}>
                  {f.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Order Cards */}
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="checkmark-circle-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>
              No {filter === 'ready_serve' ? 'ready to serve' : filter} orders
            </Text>
            <Text style={styles.emptySubtitle}>Orders will appear here when available</Text>
          </View>
        ) : (
          filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              colors={colors}
              styles={styles}
              isUpdating={updatingId === order.id}
              onStatusUpdate={handleStatusUpdate}
              onItemDelivered={handleItemDelivered}
            />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Profile Dropdown */}
      <OwnerProfileDropdown
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onOpenWallet={() => setShowWallet(true)}
      />

      {/* Wallet Modal */}
      <OwnerWalletModal
        visible={showWallet}
        onClose={() => setShowWallet(false)}
      />
    </ScreenWrapper>
  );
}

/* --- Stat Item --- */
function StatItem({ value, label, color, styles }: { value: number; label: string; color: string; styles: any }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* --- Order Card --- */
function OrderCard({ order, colors, styles, isUpdating, onStatusUpdate, onItemDelivered }: {
  order: Order;
  colors: ThemeColors;
  styles: any;
  isUpdating: boolean;
  onStatusUpdate: (id: string, status: OrderStatus) => void;
  onItemDelivered: (id: string, idx: number) => void;
}) {
  const sc = statusColors[order.status];
  const timeSince = new Date(order.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });

  const getHeaderStyle = () => {
    if (order.isReadyServe) return { bg: 'rgba(249,115,22,0.1)', iconBg: 'rgba(249,115,22,0.2)', iconColor: '#f97316', icon: 'flash' };
    switch (order.status) {
      case 'pending': return { bg: 'rgba(249,115,22,0.1)', iconBg: 'rgba(249,115,22,0.2)', iconColor: '#f97316', icon: 'time' };
      case 'preparing': return { bg: 'rgba(59,130,246,0.1)', iconBg: 'rgba(59,130,246,0.2)', iconColor: '#3b82f6', icon: 'restaurant' };
      case 'ready': return { bg: 'rgba(59,130,246,0.1)', iconBg: 'rgba(59,130,246,0.2)', iconColor: '#3b82f6', icon: 'checkmark-circle' };
      default: return { bg: 'rgba(59,130,246,0.1)', iconBg: 'rgba(59,130,246,0.2)', iconColor: '#3b82f6', icon: 'time' };
    }
  };
  const headerStyle = getHeaderStyle();

  const canCheckDeliver = !order.isReadyServe && (order.status === 'preparing' || order.status === 'partially_delivered');

  const getBadgeLabel = () => {
    if (order.isReadyServe) return 'Ready to Serve';
    return sc?.label || order.status;
  };
  const getBadgeColor = () => {
    if (order.isReadyServe) return { text: '#f97316', bg: 'rgba(249,115,22,0.12)' };
    return { text: sc?.text || '#f59e0b', bg: sc?.bg || 'rgba(245,158,11,0.12)' };
  };
  const badge = getBadgeColor();

  return (
    <View style={styles.orderCard}>
      {/* Card Header */}
      <View style={[styles.cardHeader, { backgroundColor: headerStyle.bg }]}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.statusIconCircle, { backgroundColor: headerStyle.iconBg }]}>
            <Icon name={headerStyle.icon} size={18} color={headerStyle.iconColor} />
          </View>
          <View>
            <Text style={styles.tokenText}>#{order.pickupToken}</Text>
            <Text style={styles.timeText}>{timeSince}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: badge.text }]}>{getBadgeLabel()}</Text>
        </View>
      </View>

      {/* Card Body */}
      <View style={styles.cardBody}>
        {/* Customer */}
        <View style={styles.customerRow}>
          <Icon name="person-outline" size={14} color={colors.mutedForeground} />
          <Text style={styles.customerName}>{order.userName || 'Unknown'}</Text>
        </View>

        {/* Items */}
        <View style={styles.itemsList}>
          {order.items?.map((item, idx) => {
            const isDelivered = (item as any).delivered ?? false;
            return (
              <View key={idx} style={styles.itemRow}>
                {canCheckDeliver && (
                  <TouchableOpacity
                    onPress={() => !isDelivered && onItemDelivered(order.id, idx)}
                    style={styles.checkboxBtn}
                    disabled={isDelivered}
                  >
                    <Icon
                      name={isDelivered ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={isDelivered ? colors.accent : colors.mutedForeground}
                    />
                  </TouchableOpacity>
                )}
                {resolveImageUrl(item.image) ? (
                  <Image source={{ uri: resolveImageUrl(item.image)! }} style={styles.itemImg} />
                ) : (
                  <View style={styles.itemImgPlaceholder}>
                    <Icon name="restaurant-outline" size={14} color={colors.mutedForeground} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.itemName,
                    isDelivered && { textDecorationLine: 'line-through', color: colors.mutedForeground },
                  ]}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    <Text style={{ color: colors.accent, fontWeight: '600' }}>{item.quantity}x</Text>
                    {' '}@ Rs. {item.offerPrice || item.price}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>Rs. {(item.offerPrice || item.price) * item.quantity}</Text>
              </View>
            );
          })}
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>Rs. {order.total}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {order.status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.accent, flex: 2 }]}
                onPress={() => onStatusUpdate(order.id, 'preparing')}
                disabled={isUpdating}
                activeOpacity={0.7}
              >
                {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Icon name="restaurant-outline" size={16} color="#fff" />
                    <Text style={[styles.actionText, { color: '#fff' }]}>Start Preparing</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => onStatusUpdate(order.id, 'cancelled')}
                disabled={isUpdating}
                activeOpacity={0.7}
              >
                <Icon name="close-circle" size={18} color={colors.destructive} />
              </TouchableOpacity>
            </>
          )}
          {order.status === 'preparing' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.accent, flex: 1 }]}
              onPress={() => onStatusUpdate(order.id, 'ready')}
              disabled={isUpdating}
              activeOpacity={0.7}
            >
              {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Icon name="checkmark-circle" size={16} color="#fff" />
                  <Text style={[styles.actionText, { color: '#fff' }]}>Mark Ready</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {(order.status === 'ready' || order.isReadyServe) && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: order.isReadyServe ? '#f97316' : colors.accent, flex: 1 }]}
              onPress={() => onStatusUpdate(order.id, 'completed')}
              disabled={isUpdating}
              activeOpacity={0.7}
            >
              {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Icon name="checkmark-done" size={18} color="#fff" />
                  <Text style={[styles.actionText, { color: '#fff', fontWeight: '700' }]}>
                    {order.isReadyServe ? 'Delivered' : 'Complete Order'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {order.status === 'partially_delivered' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.accent, flex: 1 }]}
              onPress={() => onStatusUpdate(order.id, 'completed')}
              disabled={isUpdating}
              activeOpacity={0.7}
            >
              {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Icon name="checkmark-done" size={18} color="#fff" />
                  <Text style={[styles.actionText, { color: '#fff', fontWeight: '700' }]}>Complete All</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

/* --- Styles --- */
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Overview Card
  overviewCard: {
    borderRadius: 20, padding: 20,
    backgroundColor: colors.accentBg,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  overviewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  overviewTitle: {
    fontSize: 11, fontWeight: '700', color: colors.mutedForeground,
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  refreshBtn: { padding: 6, borderRadius: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.mutedForeground, marginTop: 2 },

  // Filter tabs
  filterScroll: { marginTop: 16, marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  filterLabel: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },

  // Order card
  orderCard: {
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  tokenText: { fontSize: 22, fontWeight: '800', color: colors.foreground },
  timeText: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  // Card body
  cardBody: { padding: 16, paddingTop: 12 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  customerName: { fontSize: 14, color: colors.foreground },

  // Items
  itemsList: { marginBottom: 12 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  checkboxBtn: { marginRight: 8 },
  itemImg: {
    width: 40, height: 40, borderRadius: 12, marginRight: 10,
  },
  itemImgPlaceholder: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.muted,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  itemName: { fontSize: 13, fontWeight: '500', color: colors.foreground },
  itemMeta: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  itemTotal: { fontSize: 13, fontWeight: '600', color: colors.foreground },

  // Total
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.accent },

  // Actions
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 14,
  },
  rejectBtn: {
    width: 48, borderWidth: 1, borderColor: colors.destructive,
    backgroundColor: 'transparent', borderRadius: 14,
  },
  actionText: { fontSize: 13, fontWeight: '600' },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  emptySubtitle: { fontSize: 13, color: colors.mutedForeground },
});
