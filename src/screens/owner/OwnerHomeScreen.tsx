import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Image, AppState, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../../store';
import { RootState } from '../../store';
import { fetchActiveShopOrders, updateOrderStatus, markItemDelivered } from '../../store/slices/ordersSlice';
import { fetchDashboardStats, fetchShopDetails, fetchWalletBalance } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { statusColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import OwnerHeader from '../../components/owner/OwnerHeader';
import OwnerProfileDropdown from '../../components/owner/OwnerProfileDropdown';
import OwnerWalletModal from '../../components/owner/OwnerWalletModal';
import { Order, OrderStatus } from '../../types';
import { lightHaptic, mediumHaptic } from '../../utils/haptics';
import { resolveImageUrl } from '../../utils/imageUrl';
import NotificationsModal from '../../components/student/NotificationsModal';

type FilterKey = 'ready_serve' | 'pending' | 'preparing' | 'partially_ready' | 'ready';

const BASE_FILTERS: { key: FilterKey; label: string; icon: string; color: string }[] = [
  { key: 'ready_serve', label: 'Ready to Serve', icon: 'flash', color: '#f97316' },
  { key: 'pending', label: 'New', icon: 'time-outline', color: '#3b82f6' },
  { key: 'preparing', label: 'Preparing', icon: 'restaurant-outline', color: '#3b82f6' },
  { key: 'ready', label: 'Ready', icon: 'cube-outline', color: '#3b82f6' },
];

const PARTIAL_READY_FILTER = { key: 'partially_ready' as FilterKey, label: 'Partial Ready', icon: 'hourglass-outline', color: '#3b82f6' };

export default function OwnerHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const shopOrders = useAppSelector((s: RootState) => s.orders.shopOrders);
  const dashboardStats = useAppSelector((s: RootState) => s.user.dashboardStats);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reject order modal state
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; orderId: string; token: string }>({ visible: false, orderId: '', token: '' });
  const [rejectLoading, setRejectLoading] = useState(false);

  // Item confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    type: 'ready' | 'deliver';
    itemName: string;
    orderId: string;
    itemIndex: number;
  }>({ visible: false, type: 'ready', itemName: '', orderId: '', itemIndex: 0 });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      await Promise.all([
        dispatch(fetchActiveShopOrders()),
        dispatch(fetchDashboardStats()),
        dispatch(fetchShopDetails()),
        dispatch(fetchWalletBalance()),
      ]);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 5 seconds, pause when app is backgrounded
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const stopPolling = () => { if (interval) { clearInterval(interval); interval = null; } };
    const startPolling = () => {
      stopPolling();
      interval = setInterval(() => {
        dispatch(fetchActiveShopOrders());
        dispatch(fetchDashboardStats());
      }, 30000);
    };
    startPolling();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') { startPolling(); dispatch(fetchActiveShopOrders()); dispatch(fetchDashboardStats()); }
      else stopPolling();
    });
    return () => { stopPolling(); sub.remove(); };
  }, [dispatch]);

  // Auto-refresh wallet balance every 30 seconds (backup for socket events)
  useEffect(() => {
    let walletInterval: ReturnType<typeof setInterval> | null = null;
    const stopWalletPolling = () => { if (walletInterval) { clearInterval(walletInterval); walletInterval = null; } };
    const startWalletPolling = () => { stopWalletPolling(); walletInterval = setInterval(() => dispatch(fetchWalletBalance()), 30000); };
    startWalletPolling();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') startWalletPolling(); else stopWalletPolling();
    });
    return () => { stopWalletPolling(); sub.remove(); };
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

  // Stats — memoized
  const activeOrders = useMemo(() => shopOrders.filter(o => !['completed', 'cancelled'].includes(o.status)), [shopOrders]);
  const pendingCount = useMemo(() => activeOrders.filter(o => o.status === 'pending').length, [activeOrders]);
  const preparingCount = useMemo(() => activeOrders.filter(o => o.status === 'preparing').length, [activeOrders]);
  const partiallyReadyCount = useMemo(() => activeOrders.filter(o => o.status === 'partially_ready').length, [activeOrders]);
  const readyCount = useMemo(() => activeOrders.filter(o => (o.status === 'ready' || o.status === 'partially_delivered') && !o.isReadyServe).length, [activeOrders]);
  const readyServeCount = useMemo(() => activeOrders.filter(o => o.isReadyServe && o.status === 'ready').length, [activeOrders]);
  const inProgressCount = pendingCount + preparingCount + partiallyReadyCount + readyCount;
  const completedToday = dashboardStats?.completedToday ?? 0;
  const cancelledToday = dashboardStats?.cancelledToday ?? 0;
  const totalOrders = inProgressCount + completedToday + cancelledToday;

  // Dynamic filters — partially_ready tab only visible when there are partially_ready orders
  const filters = useMemo(() => {
    if (partiallyReadyCount > 0) {
      const idx = BASE_FILTERS.findIndex(f => f.key === 'ready');
      const arr = [...BASE_FILTERS];
      arr.splice(idx, 0, PARTIAL_READY_FILTER);
      return arr;
    }
    return BASE_FILTERS;
  }, [partiallyReadyCount]);

  // Filter orders — memoized
  // For partially_ready orders, we create split "views":
  //   - Preparing tab shows the order with only still-preparing items
  //   - Partially Ready tab shows the order with only ready items
  const filteredOrders = useMemo(() => {
    let orders: Order[];
    if (filter === 'ready_serve') {
      orders = activeOrders.filter(o => o.isReadyServe && o.status === 'ready');
    } else if (filter === 'partially_ready') {
      orders = activeOrders
        .filter(o => o.status === 'partially_ready')
        .map(o => ({
          ...o,
          _splitView: 'ready' as const,
          items: o.items.map((item, i) => ({ ...item, _originalIdx: i })).filter(i => (i.itemStatus || 'preparing') === 'ready'),
        }))
        .filter(o => o.items.length > 0);
    } else if (filter === 'preparing') {
      const normal = activeOrders.filter(o => {
        if (o.isReadyServe && o.status === 'ready') return false;
        return o.status === 'preparing';
      });
      const splitPreparing = activeOrders
        .filter(o => o.status === 'partially_ready')
        .map(o => ({
          ...o,
          _splitView: 'preparing' as const,
          items: o.items.map((item, i) => ({ ...item, _originalIdx: i })).filter(i => (i.itemStatus || 'preparing') === 'preparing'),
        }))
        .filter(o => o.items.length > 0);
      orders = [...normal, ...splitPreparing];
    } else {
      orders = activeOrders.filter(o => {
        if (o.isReadyServe && o.status === 'ready') return false;
        if (filter === 'ready' && o.status === 'partially_delivered') return true;
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
  }, [activeOrders, filter, searchQuery]);

  const getFilterCount = (key: FilterKey) => {
    if (key === 'ready_serve') return readyServeCount;
    if (key === 'partially_ready') return partiallyReadyCount;
    if (key === 'ready') return readyCount;
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

  const handleMarkItemReady = (orderId: string, itemIndex: number, itemName: string) => {
    mediumHaptic();
    setConfirmModal({ visible: true, type: 'ready', itemName, orderId, itemIndex });
  };

  const handleDeliverItem = (orderId: string, itemIndex: number, itemName: string) => {
    mediumHaptic();
    setConfirmModal({ visible: true, type: 'deliver', itemName, orderId, itemIndex });
  };

  const handleConfirmAction = async () => {
    const { orderId, itemIndex, type } = confirmModal;
    setConfirmLoading(true);
    try {
      await dispatch(markItemDelivered({ orderId, itemIndex, itemStatus: type === 'ready' ? 'ready' : 'delivered' })).unwrap();
    } catch {
      Alert.alert('Error', 'Failed to update item');
    }
    setConfirmLoading(false);
    setConfirmModal(prev => ({ ...prev, visible: false }));
  };

  const handleDismissConfirm = () => {
    if (!confirmLoading) setConfirmModal(prev => ({ ...prev, visible: false }));
  };

  const handleItemDelivered = (orderId: string, itemIndex: number) => {
    const order = shopOrders.find(o => o.id === orderId);
    const item = order?.items[itemIndex];
    if (!item) return;
    const status = item.itemStatus || 'preparing';
    if (status === 'preparing') handleMarkItemReady(orderId, itemIndex, item.name);
    else if (status === 'ready') handleDeliverItem(orderId, itemIndex, item.name);
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
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Today's Overview Card */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>TODAY'S OVERVIEW</Text>
            <TouchableOpacity onPress={handleRefreshStats} style={styles.refreshBtn} disabled={isRefreshing} accessibilityLabel="Refresh stats" accessibilityRole="button">
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
          {filters.map(f => {
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
                onPress={() => { lightHaptic(); setFilter(f.key); }}
                activeOpacity={0.7}
                accessibilityLabel={`${f.label} filter`}
                accessibilityRole="button"
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
              key={`${order.id}-${(order as any)._splitView || 'full'}`}
              order={order}
              colors={colors}
              styles={styles}
              isUpdating={updatingId === order.id}
              onStatusUpdate={handleStatusUpdate}
              onItemDelivered={handleItemDelivered}
              onReject={(id, token) => setRejectModal({ visible: true, orderId: id, token })}
            />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Profile Dropdown */}
      <OwnerProfileDropdown
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onOpenWallet={() => { setShowProfile(false); setShowWallet(true); }}
        onNavigateNotifications={() => { setShowProfile(false); setShowNotifications(true); }}
      />
      <NotificationsModal visible={showNotifications} onClose={() => setShowNotifications(false)} />

      {/* Wallet Modal */}
      <OwnerWalletModal
        visible={showWallet}
        onClose={() => setShowWallet(false)}
      />

      {/* Item Confirmation Modal */}
      <Modal visible={confirmModal.visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleDismissConfirm}>
        <TouchableOpacity style={styles.confirmOverlay} activeOpacity={1} onPress={handleDismissConfirm}>
          <TouchableOpacity activeOpacity={1} style={styles.confirmDialog}>
            <View style={[styles.confirmIconWrap, { backgroundColor: confirmModal.type === 'ready' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)' }]}>
              <Icon
                name={confirmModal.type === 'ready' ? 'checkmark-circle' : 'bag-check-outline'}
                size={28}
                color={confirmModal.type === 'ready' ? '#3b82f6' : '#22c55e'}
              />
            </View>
            <Text style={styles.confirmTitle}>
              {confirmModal.type === 'ready' ? 'Mark Item Ready' : 'Deliver Item'}
            </Text>
            <Text style={styles.confirmMessage}>
              {confirmModal.type === 'ready'
                ? `Mark "${confirmModal.itemName}" as ready for pickup?`
                : `Hand over "${confirmModal.itemName}" to the student?`}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={handleDismissConfirm} disabled={confirmLoading} activeOpacity={0.7}>
                <Text style={styles.confirmCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmActionBtn, { backgroundColor: confirmModal.type === 'ready' ? '#3b82f6' : '#22c55e' }]}
                onPress={handleConfirmAction}
                disabled={confirmLoading}
                activeOpacity={0.7}
              >
                {confirmLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmActionText}>
                    {confirmModal.type === 'ready' ? 'CONFIRM' : 'DELIVER'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Reject Order Modal */}
      <Modal visible={rejectModal.visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => !rejectLoading && setRejectModal(prev => ({ ...prev, visible: false }))}>
        <TouchableOpacity style={styles.confirmOverlay} activeOpacity={1} onPress={() => !rejectLoading && setRejectModal(prev => ({ ...prev, visible: false }))}>
          <TouchableOpacity activeOpacity={1} style={styles.confirmDialog}>
            <View style={[styles.confirmIconWrap, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
              <Icon name="close-circle" size={28} color="#ef4444" />
            </View>
            <Text style={styles.confirmTitle}>Reject Order</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to reject order #{rejectModal.token}? The amount will be refunded to the student's wallet.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setRejectModal(prev => ({ ...prev, visible: false }))} disabled={rejectLoading} activeOpacity={0.7}>
                <Text style={styles.confirmCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmActionBtn, { backgroundColor: '#ef4444' }]}
                onPress={async () => {
                  setRejectLoading(true);
                  await handleStatusUpdate(rejectModal.orderId, 'cancelled');
                  setRejectLoading(false);
                  setRejectModal(prev => ({ ...prev, visible: false }));
                }}
                disabled={rejectLoading}
                activeOpacity={0.7}
              >
                {rejectLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmActionText}>REJECT</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </ScreenWrapper>
  );
}

/* --- Stat Item --- */
const StatItem = React.memo(({ value, label, color, styles }: { value: number; label: string; color: string; styles: any }) => {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

/* --- Order Card --- */
const OrderCard = React.memo(function OrderCard({ order, colors, styles, isUpdating, onStatusUpdate, onItemDelivered, onReject }: {
  order: Order;
  colors: ThemeColors;
  styles: any;
  isUpdating: boolean;
  onStatusUpdate: (id: string, status: OrderStatus) => void;
  onItemDelivered: (id: string, idx: number) => void;
  onReject: (id: string, token: string) => void;
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
      case 'partially_ready': return { bg: 'rgba(59,130,246,0.1)', iconBg: 'rgba(59,130,246,0.2)', iconColor: '#3b82f6', icon: 'hourglass' };
      case 'ready': return { bg: 'rgba(59,130,246,0.1)', iconBg: 'rgba(59,130,246,0.2)', iconColor: '#3b82f6', icon: 'checkmark-circle' };
      default: return { bg: 'rgba(59,130,246,0.1)', iconBg: 'rgba(59,130,246,0.2)', iconColor: '#3b82f6', icon: 'time' };
    }
  };
  const headerStyle = getHeaderStyle();

  const canCheckDeliver = !order.isReadyServe && (order.status === 'preparing' || order.status === 'partially_ready' || order.status === 'ready' || order.status === 'partially_delivered');

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
            const iStatus = item.itemStatus || 'preparing';
            const isReady = iStatus === 'ready';
            const isItemDelivered = iStatus === 'delivered';
            const iconName = isItemDelivered ? 'checkmark-done-circle' : isReady ? 'checkbox' : 'square-outline';
            const iconColor = isItemDelivered ? '#22c55e' : isReady ? '#3b82f6' : colors.mutedForeground;
            const apiIdx = (item as any)._originalIdx ?? idx;
            return (
              <View key={apiIdx} style={styles.itemRow}>
                {canCheckDeliver && (
                  <TouchableOpacity
                    onPress={() => {
                      if (iStatus === 'preparing') onItemDelivered(order.id, apiIdx);
                      else if (iStatus === 'ready') onItemDelivered(order.id, apiIdx);
                    }}
                    style={styles.checkboxBtn}
                    disabled={isItemDelivered}
                    accessibilityLabel={
                      isItemDelivered ? `${item.name} delivered` :
                      isReady ? `Deliver ${item.name}` :
                      `Mark ${item.name} ready`
                    }
                    accessibilityRole="button"
                  >
                    <Icon name={iconName} size={20} color={iconColor} />
                  </TouchableOpacity>
                )}
                {resolveImageUrl(item.image) ? (
                  <Image source={{ uri: resolveImageUrl(item.image)! }} style={styles.itemImg} accessibilityLabel={`${item.name} image`} />
                ) : (
                  <View style={styles.itemImgPlaceholder}>
                    <Icon name="restaurant-outline" size={14} color={colors.mutedForeground} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.itemName,
                    isItemDelivered && { textDecorationLine: 'line-through', color: colors.mutedForeground },
                  ]}>
                    {item.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.itemMeta}>
                      <Text style={{ color: colors.accent, fontWeight: '600' }}>{item.quantity}x</Text>
                      {' '}@ Rs. {item.offerPrice || item.price}
                    </Text>
                    {isReady && <Text style={{ fontSize: 10, fontWeight: '700', color: '#3b82f6' }}>READY</Text>}
                    {isItemDelivered && <Text style={{ fontSize: 10, fontWeight: '700', color: '#22c55e' }}>DELIVERED</Text>}
                  </View>
                </View>
                <Text style={styles.itemTotal}>Rs. {(item.offerPrice || item.price) * item.quantity}</Text>
              </View>
            );
          })}
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            {(order as any)._splitView ? `Subtotal (${order.items.length} item${order.items.length !== 1 ? 's' : ''})` : 'Total'}
          </Text>
          <Text style={styles.totalValue}>
            Rs. {(order as any)._splitView
              ? order.items.reduce((sum, i) => sum + (i.offerPrice || i.price) * i.quantity, 0)
              : order.total}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {order.status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.accent, flex: 2 }]}
                onPress={() => { mediumHaptic(); onStatusUpdate(order.id, 'preparing'); }}
                disabled={isUpdating}
                activeOpacity={0.7}
                accessibilityLabel="Start preparing"
                accessibilityRole="button"
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
                onPress={() => { mediumHaptic(); onReject(order.id, order.pickupToken); }}
                disabled={isUpdating}
                activeOpacity={0.7}
                accessibilityLabel="Reject order"
                accessibilityRole="button"
              >
                <Icon name="close-circle" size={18} color={colors.destructive} />
              </TouchableOpacity>
            </>
          )}
          {/* No "Mark Ready" button in preparing — items auto-move the order when all checked ready */}
          {(order.status === 'ready' || order.isReadyServe) && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: order.isReadyServe ? '#f97316' : colors.accent, flex: 1 }]}
              onPress={() => { mediumHaptic(); onStatusUpdate(order.id, 'completed'); }}
              disabled={isUpdating}
              activeOpacity={0.7}
              accessibilityLabel={order.isReadyServe ? 'Mark delivered' : 'Complete order'}
              accessibilityRole="button"
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
              onPress={() => { mediumHaptic(); onStatusUpdate(order.id, 'completed'); }}
              disabled={isUpdating}
              activeOpacity={0.7}
              accessibilityLabel="Complete all items"
              accessibilityRole="button"
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
});

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

  // Confirm modal
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  confirmDialog: {
    width: '100%', maxWidth: 320, backgroundColor: colors.card,
    borderRadius: 20, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24,
    elevation: 16,
  },
  confirmIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 8, textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14, color: colors.mutedForeground, textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row', gap: 12, width: '100%',
  },
  confirmCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.muted, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  confirmCancelText: {
    fontSize: 14, fontWeight: '700', color: colors.foreground, letterSpacing: 0.5,
  },
  confirmActionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmActionText: {
    fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.5,
  },

});
