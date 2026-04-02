import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, FlatList, Image, AppState, Modal, Animated, PanResponder, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../../store';
import { RootState } from '../../store';
import { fetchActiveShopOrders, updateOrderStatus, markItemDelivered } from '../../store/slices/ordersSlice';
import { fetchDashboardStats, fetchWalletBalance } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { statusColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import CaptainHeader from '../../components/captain/CaptainHeader';
import CaptainProfileDropdown from '../../components/captain/CaptainProfileDropdown';
import NotificationsModal from '../../components/student/NotificationsModal';
import { Order, OrderStatus } from '../../types';
import { lightHaptic, mediumHaptic } from '../../utils/haptics';
import { resolveImageUrl } from '../../utils/imageUrl';

type FilterKey = 'ready_serve' | 'pending' | 'preparing' | 'partially_ready' | 'ready';

const BASE_FILTERS: { key: FilterKey; label: string; icon: string; color: string }[] = [
  { key: 'ready_serve', label: 'Ready to Serve', icon: 'flash', color: '#f97316' },
  { key: 'pending', label: 'New', icon: 'time-outline', color: '#3b82f6' },
  { key: 'preparing', label: 'Preparing', icon: 'restaurant-outline', color: '#3b82f6' },
  { key: 'ready', label: 'Ready', icon: 'cube-outline', color: '#3b82f6' },
];

const PARTIAL_READY_FILTER = { key: 'partially_ready' as FilterKey, label: 'Partial Ready', icon: 'hourglass-outline', color: '#8b5cf6' };

interface SwipeAction {
  label: string;
  icon: string;
  color: string;
  onAction: () => void;
}

function getSwipeConfig(
  filter: FilterKey,
  order: Order,
  onStatusUpdate: (id: string, status: OrderStatus) => void,
  onBatchReady: (id: string) => void,
  onReject: (id: string, token: string) => void,
): { right: SwipeAction | null; left: SwipeAction | null } {
  switch (filter) {
    case 'pending':
      return {
        right: { label: 'Start', icon: 'restaurant-outline', color: '#3b82f6', onAction: () => onStatusUpdate(order.id, 'preparing') },
        left: { label: 'Reject', icon: 'close', color: '#ef4444', onAction: () => onReject(order.id, order.pickupToken) },
      };
    case 'preparing':
      return {
        right: { label: 'All Ready', icon: 'checkmark-done', color: '#22c55e', onAction: () => onBatchReady(order.id) },
        left: null,
      };
    case 'partially_ready':
      return {
        right: { label: 'All Ready', icon: 'checkmark-done', color: '#22c55e', onAction: () => onBatchReady(order.id) },
        left: null,
      };
    case 'ready':
      return {
        right: { label: 'Delivered', icon: 'checkmark', color: '#22c55e', onAction: () => onStatusUpdate(order.id, 'completed') },
        left: null,
      };
    case 'ready_serve':
      return {
        right: { label: 'Delivered', icon: 'checkmark', color: '#22c55e', onAction: () => onStatusUpdate(order.id, 'completed') },
        left: { label: 'Reject', icon: 'close', color: '#ef4444', onAction: () => onReject(order.id, order.pickupToken) },
      };
    default:
      return { right: null, left: null };
  }
}

export default function CaptainHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const user = useAppSelector((s: RootState) => s.auth.user);
  const shopOrders = useAppSelector((s: RootState) => s.orders.shopOrders);
  const dashboardStats = useAppSelector((s: RootState) => s.user.dashboardStats);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Partial pickup full-screen overlay (iOS feature)
  const [partialPickupOverlay, setPartialPickupOverlay] = useState<{ visible: boolean; token: string }>({ visible: false, token: '' });

  // Reject order modal state (Android feature)
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
        dispatch(fetchWalletBalance()),
      ]);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Single polling interval: orders + stats + wallet every 30s while focused
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchActiveShopOrders());
      dispatch(fetchDashboardStats());
      let interval: ReturnType<typeof setInterval> | null = null;
      const stopPolling = () => { if (interval) { clearInterval(interval); interval = null; } };
      const startPolling = () => {
        stopPolling();
        interval = setInterval(() => {
          dispatch(fetchActiveShopOrders());
          dispatch(fetchDashboardStats());
          dispatch(fetchWalletBalance());
        }, 30000);
      };
      startPolling();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') { startPolling(); dispatch(fetchActiveShopOrders()); dispatch(fetchDashboardStats()); }
        else stopPolling();
      });
      return () => { stopPolling(); sub.remove(); };
    }, [dispatch])
  );

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
  // Count both 'ready' and 'partially_delivered' as "ready" — partially delivered orders still have
  // remaining items that are ready for collection and must stay visible in the Ready tab.
  const readyCount = useMemo(() => activeOrders.filter(o => (o.status === 'ready' || o.status === 'partially_delivered') && !o.isReadyServe).length, [activeOrders]);
  const readyServeCount = useMemo(() => activeOrders.filter(o => o.isReadyServe && o.status === 'ready').length, [activeOrders]);
  const inProgressCount = pendingCount + preparingCount + partiallyReadyCount + readyCount;
  const completedToday = dashboardStats?.completedToday ?? 0;
  const cancelledToday = dashboardStats?.cancelledToday ?? 0;
  const totalOrders = inProgressCount + completedToday + cancelledToday;

  // Dynamic filters — partially_ready tab only visible when there are partially_ready orders
  const filters = useMemo(() => {
    if (partiallyReadyCount > 0) {
      // Insert partially_ready before 'ready'
      const idx = BASE_FILTERS.findIndex(f => f.key === 'ready');
      const arr = [...BASE_FILTERS];
      arr.splice(idx, 0, PARTIAL_READY_FILTER);
      return arr;
    }
    return BASE_FILTERS;
  }, [partiallyReadyCount]);

  // Filter orders — memoized for performance
  // For partially_ready orders, we create split "views":
  //   - Preparing tab shows the order with only still-preparing items
  //   - Partially Ready tab shows the order with only ready items
  const filteredOrders = useMemo(() => {
    let orders: Order[];
    if (filter === 'ready_serve') {
      orders = activeOrders.filter(o => o.isReadyServe && o.status === 'ready');
    } else if (filter === 'partially_ready') {
      // Show only the ready items from partially_ready orders, preserving original indices
      orders = activeOrders
        .filter(o => o.status === 'partially_ready')
        .map(o => ({
          ...o,
          _splitView: 'ready' as const,
          items: o.items
            .map((item, i) => ({ ...item, _originalIdx: i }))
            .filter(i => (i.itemStatus || 'preparing') === 'ready'),
        }))
        .filter(o => o.items.length > 0);
    } else if (filter === 'preparing') {
      // Normal preparing orders + partially_ready orders showing only their preparing items
      const normal = activeOrders.filter(o => {
        if (o.isReadyServe && o.status === 'ready') return false;
        return o.status === 'preparing';
      });
      const splitPreparing = activeOrders
        .filter(o => o.status === 'partially_ready')
        .map(o => ({
          ...o,
          _splitView: 'preparing' as const,
          items: o.items
            .map((item, i) => ({ ...item, _originalIdx: i }))
            .filter(i => (i.itemStatus || 'preparing') === 'preparing'),
        }))
        .filter(o => o.items.length > 0);
      orders = [...normal, ...splitPreparing];
    } else {
      orders = activeOrders.filter(o => {
        if (o.isReadyServe && o.status === 'ready') return false;
        // 'partially_delivered' orders belong to the 'ready' tab — they were 'ready' and
        // are being scanned; remaining items are still ready for collection.
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
  // Batch mark all preparing items as ready (for swipe on preparing/partial ready)
  const handleBatchMarkReady = async (orderId: string) => {
    const order = shopOrders.find(o => o.id === orderId);
    if (!order) return;
    setUpdatingId(orderId);
    try {
      for (let i = 0; i < order.items.length; i++) {
        if ((order.items[i].itemStatus || 'preparing') === 'preparing') {
          await dispatch(markItemDelivered({ orderId, itemIndex: i, itemStatus: 'ready' })).unwrap();
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to update items');
    }
    setUpdatingId(null);
  };

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await dispatch(updateOrderStatus({ orderId, status: newStatus })).unwrap();
    } catch {
      // Silently refresh — order likely already moved by another captain or auto-transition
      dispatch(fetchActiveShopOrders());
      dispatch(fetchDashboardStats());
    }
    setUpdatingId(null);
  };

  // Show themed confirmation modal for item status change
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
      const prevOrder = shopOrders.find(o => o.id === orderId);
      const prevStatus = prevOrder?.status;
      const result = await dispatch(markItemDelivered({ orderId, itemIndex, itemStatus: type === 'ready' ? 'ready' : 'delivered' })).unwrap();
      // Show partial pickup overlay when order transitions to partially_ready (iOS feature)
      if (result?.status === 'partially_ready' && prevStatus !== 'partially_ready') {
        const token = result.pickupToken || prevOrder?.pickupToken || '';
        setPartialPickupOverlay({ visible: true, token });
      }
    } catch {
      Alert.alert('Error', 'Failed to update item');
    }
    setConfirmLoading(false);
    setConfirmModal(prev => ({ ...prev, visible: false }));
  };

  const handleDismissConfirm = () => {
    if (!confirmLoading) setConfirmModal(prev => ({ ...prev, visible: false }));
  };

  // Legacy handler (kept for compatibility with onItemDelivered prop)
  const handleItemDelivered = (orderId: string, itemIndex: number) => {
    if (__DEV__) console.log('[OrderCard] handleItemDelivered:', orderId, 'idx:', itemIndex);
    const order = shopOrders.find(o => o.id === orderId);
    const item = order?.items[itemIndex];
    if (!item) { if (__DEV__) console.log('[OrderCard] item not found at index', itemIndex, 'order items:', order?.items.length); return; }
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
      <CaptainHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showSearch={showSearch}
        onToggleSearch={handleToggleSearch}
        onProfilePress={() => setShowProfile(true)}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Today's Overview Card - Blue gradient */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>TODAY'S OVERVIEW</Text>
            <TouchableOpacity onPress={handleRefreshStats} style={styles.refreshBtn} disabled={isRefreshing} accessibilityLabel="Refresh stats" accessibilityRole="button">
              <Icon
                name="refresh"
                size={16}
                color={colors.mutedForeground}
              />
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
            const isPurple = f.key === 'partially_ready';
            const activeColor = isOrange ? '#f97316' : isPurple ? '#8b5cf6' : colors.accent;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterTab,
                  isActive && { backgroundColor: activeColor },
                ]}
                onPress={() => { lightHaptic(); setFilter(f.key); }}
                activeOpacity={0.7}
                accessibilityLabel={`Filter ${f.label}`}
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
          filteredOrders.map(order => {
            // Swipe config per tab
            const swipeCfg = getSwipeConfig(filter, order, handleStatusUpdate, handleBatchMarkReady,
              (id: string, token: string) => setRejectModal({ visible: true, orderId: id, token }));
            return (
              <SwipeableOrderCard
                key={`${order.id}-${(order as any)._splitView || 'full'}`}
                order={order}
                colors={colors}
                styles={styles}
                isUpdating={updatingId === order.id}
                dispatch={dispatch}
                swipeRight={swipeCfg.right}
                swipeLeft={swipeCfg.left}
                showCheckboxes={filter === 'preparing' || filter === 'partially_ready'}
              />
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Profile Dropdown */}
      <CaptainProfileDropdown
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onNavigateNotifications={() => setShowNotifications(true)}
      />

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
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
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={handleDismissConfirm} disabled={confirmLoading} activeOpacity={0.7} accessibilityLabel="Cancel" accessibilityRole="button">
                <Text style={styles.confirmCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmActionBtn, { backgroundColor: confirmModal.type === 'ready' ? '#3b82f6' : '#22c55e' }]}
                onPress={handleConfirmAction}
                disabled={confirmLoading}
                activeOpacity={0.7}
                accessibilityLabel={confirmModal.type === 'ready' ? 'Confirm item ready' : 'Confirm deliver item'}
                accessibilityRole="button"
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

      {/* Reject Order Modal (Android feature) */}
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
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setRejectModal(prev => ({ ...prev, visible: false }))} disabled={rejectLoading} activeOpacity={0.7} accessibilityLabel="Cancel reject" accessibilityRole="button">
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
                accessibilityLabel="Confirm reject order"
                accessibilityRole="button"
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

      {/* Partial Pickup Full-Screen Overlay (iOS feature) */}
      <Modal visible={partialPickupOverlay.visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPartialPickupOverlay({ visible: false, token: '' })}>
        <View style={styles.partialOverlay}>
          <View style={styles.partialOverlayContent}>
            <View style={styles.partialIconWrap}>
              <Icon name="checkmark-circle" size={64} color="#fff" />
            </View>
            <Text style={styles.partialTitle}>Item Ready for Partial Pickup</Text>
            {partialPickupOverlay.token ? (
              <Text style={styles.partialToken}>#{partialPickupOverlay.token}</Text>
            ) : null}
            <Text style={styles.partialSubtitle}>
              Some items have been handed over. Remaining items will be available once ready.
            </Text>
            <TouchableOpacity
              style={styles.partialDismissBtn}
              onPress={() => setPartialPickupOverlay({ visible: false, token: '' })}
              activeOpacity={0.8}
              accessibilityLabel="Dismiss partial pickup notification"
              accessibilityRole="button"
            >
              <Text style={styles.partialDismissText}>GOT IT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScreenWrapper>
  );
}

/* ─── Swipeable Order Card (All Tabs) ─── */
const SWIPE_THRESHOLD = 80;
const SwipeableOrderCard = React.memo(function SwipeableOrderCard({ order, colors, styles, isUpdating, swipeRight, swipeLeft, showCheckboxes, dispatch }: {
  order: Order;
  colors: ThemeColors;
  styles: any;
  isUpdating: boolean;
  swipeRight: SwipeAction | null;
  swipeLeft: SwipeAction | null;
  showCheckboxes: boolean;
  dispatch: any;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const sc = statusColors[order.status];
  const badge = order.isReadyServe
    ? { text: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'Ready to Serve' }
    : { text: sc?.text || '#f59e0b', bg: sc?.bg || 'rgba(245,158,11,0.12)', label: sc?.label || order.status };
  const timeSince = new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const displayTotal = (order as any)._splitView
    ? order.items.reduce((sum: number, i: any) => sum + (i.offerPrice || i.price) * i.quantity, 0)
    : order.total;

  // Toggle item selection (preparing tab — no API call, just visual toggle)
  const toggleItem = useCallback((apiIdx: number) => {
    mediumHaptic();
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(apiIdx)) next.delete(apiIdx); else next.add(apiIdx);
      return next;
    });
  }, []);

  // Batch mark selected items as ready (called on swipe right for preparing/partial ready)
  const batchMarkSelected = useCallback(async () => {
    const indices = showCheckboxes && selectedItems.size > 0
      ? Array.from(selectedItems)
      : order.items.map((_, i) => (order.items[i] as any)._originalIdx ?? i).filter(i => {
          const item = order.items.find((_, idx) => ((order.items[idx] as any)._originalIdx ?? idx) === i);
          return item && (item.itemStatus || 'preparing') === 'preparing';
        });
    if (indices.length === 0) return;
    for (const idx of indices) {
      try {
        await dispatch(markItemDelivered({ orderId: order.id, itemIndex: idx, itemStatus: 'ready' })).unwrap();
      } catch { /* continue with remaining */ }
    }
    setSelectedItems(new Set());
  }, [dispatch, order, selectedItems, showCheckboxes]);

  // Override swipe right for preparing/partial ready to use batch selection
  const effectiveSwipeRight = useMemo(() => {
    if (!swipeRight) return null;
    if (showCheckboxes) {
      const count = selectedItems.size;
      return {
        ...swipeRight,
        label: count > 0 ? `${count} Ready` : swipeRight.label,
        onAction: batchMarkSelected,
      };
    }
    return swipeRight;
  }, [swipeRight, showCheckboxes, selectedItems.size, batchMarkSelected]);

  // Use refs for swipe actions so PanResponder always has latest
  const swipeRightRef = useRef(effectiveSwipeRight);
  const swipeLeftRef = useRef(swipeLeft);
  swipeRightRef.current = effectiveSwipeRight;
  swipeLeftRef.current = swipeLeft;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => {
      if (g.dx > 0 && !swipeRightRef.current) return;
      if (g.dx < 0 && !swipeLeftRef.current) return;
      translateX.setValue(g.dx);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_THRESHOLD && swipeRightRef.current) {
        Animated.timing(translateX, { toValue: Dimensions.get('window').width, duration: 200, useNativeDriver: true }).start(() => {
          mediumHaptic();
          swipeRightRef.current?.onAction();
          setTimeout(() => translateX.setValue(0), 300);
        });
      } else if (g.dx < -SWIPE_THRESHOLD && swipeLeftRef.current) {
        Animated.timing(translateX, { toValue: -Dimensions.get('window').width, duration: 200, useNativeDriver: true }).start(() => {
          mediumHaptic();
          swipeLeftRef.current?.onAction();
          setTimeout(() => translateX.setValue(0), 300);
        });
      } else {
        Animated.spring(translateX, { toValue: 0, friction: 8, useNativeDriver: true }).start();
      }
    },
  })).current;

  // Build hint text
  const hintParts: string[] = [];
  if (swipeLeft) hintParts.push(`← ${swipeLeft.label}`);
  if (effectiveSwipeRight) hintParts.push(`${effectiveSwipeRight.label} →`);
  const hintText = hintParts.join('  |  ');

  return (
    <View style={styles.swipeContainer}>
      {/* Right swipe background */}
      {effectiveSwipeRight && (
        <Animated.View style={[styles.swipeBgFull, { backgroundColor: effectiveSwipeRight.color, opacity: translateX.interpolate({ inputRange: [0, 30], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
          <View style={styles.swipeBgContent}>
            <Icon name={effectiveSwipeRight.icon} size={24} color="#fff" />
            <Text style={styles.swipeBgText}>{effectiveSwipeRight.label}</Text>
          </View>
        </Animated.View>
      )}
      {/* Left swipe background */}
      {swipeLeft && (
        <Animated.View style={[styles.swipeBgFull, { backgroundColor: swipeLeft.color, opacity: translateX.interpolate({ inputRange: [-30, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
          <View style={[styles.swipeBgContent, { justifyContent: 'flex-end' }]}>
            <Text style={styles.swipeBgText}>{swipeLeft.label}</Text>
            <Icon name={swipeLeft.icon} size={24} color="#fff" />
          </View>
        </Animated.View>
      )}

      {/* Card */}
      <Animated.View style={[styles.swipeCard, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.tokenText}>#{order.pickupToken}</Text>
          <Text style={styles.timeText}>{timeSince}</Text>
          <Text style={styles.customerName} numberOfLines={1}>{order.userName || '—'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
          <Text style={styles.totalValue}>₹{displayTotal}</Text>
        </View>

        {/* Items */}
        {order.items.map((item, idx) => {
          const iStatus = item.itemStatus || 'preparing';
          const isReady = iStatus === 'ready';
          const isItemDelivered = iStatus === 'delivered';
          const apiIdx = (item as any)._originalIdx ?? idx;
          return (
            <View key={apiIdx} style={styles.itemRow}>
              {showCheckboxes && (
                <TouchableOpacity
                  onPress={() => toggleItem(apiIdx)}
                  style={styles.checkboxBtn}
                  disabled={isItemDelivered || isReady}
                  accessibilityLabel={
                    isItemDelivered ? `${item.name} delivered` :
                    isReady ? `${item.name} ready` :
                    `Select ${item.name}`
                  }
                  accessibilityRole="button"
                >
                  <Icon
                    name={isItemDelivered ? 'checkmark-circle' : isReady ? 'checkbox' : selectedItems.has(apiIdx) ? 'checkbox' : 'square-outline'}
                    size={16}
                    color={isItemDelivered ? '#22c55e' : isReady ? '#3b82f6' : selectedItems.has(apiIdx) ? colors.accent : colors.mutedForeground}
                  />
                </TouchableOpacity>
              )}
              {resolveImageUrl(item.image) ? (
                <Image source={{ uri: resolveImageUrl(item.image)! }} style={styles.itemImg} accessibilityLabel={`${item.name} image`} />
              ) : (
                <View style={styles.itemImgPlaceholder}>
                  <Icon name="restaurant-outline" size={10} color={colors.mutedForeground} />
                </View>
              )}
              <Text style={[styles.itemName, isItemDelivered && styles.itemDone]} numberOfLines={1}>
                {item.quantity}x {item.name}
              </Text>
              {isReady && <Text style={styles.readyTag}>READY</Text>}
              {isItemDelivered && <Text style={styles.doneTag}>DONE</Text>}
              <Text style={styles.itemPrice}>₹{(item.offerPrice || item.price) * item.quantity}</Text>
            </View>
          );
        })}

        {/* Swipe hint */}
        {hintText ? (
          <View style={styles.swipeHint}>
            <Text style={styles.swipeHintText}>{hintText}</Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
});

/* ─── Stat Item ─── */
const StatItem = React.memo(({ value, label, color, styles }: { value: number; label: string; color: string; styles: any }) => {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

/* ─── OLD OrderCard removed — SwipeableOrderCard replaces it ─── */
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

  // Status icon and header color
  const getHeaderStyle = () => {
    if (order.isReadyServe) return { bg: 'rgba(249,115,22,0.1)', iconBg: 'rgba(249,115,22,0.2)', iconColor: '#f97316', icon: 'flash' };
    switch (order.status) {
      case 'pending': return { bg: 'rgba(249,115,22,0.1)', iconBg: 'rgba(249,115,22,0.2)', iconColor: '#f97316', icon: 'time' };
      case 'preparing': return { bg: 'rgba(59,130,246,0.1)', iconBg: 'rgba(59,130,246,0.2)', iconColor: '#3b82f6', icon: 'restaurant' };
      case 'partially_ready': return { bg: 'rgba(139,92,246,0.1)', iconBg: 'rgba(139,92,246,0.2)', iconColor: '#8b5cf6', icon: 'hourglass' };
      case 'ready': return { bg: 'rgba(59,130,246,0.1)', iconBg: 'rgba(59,130,246,0.2)', iconColor: '#3b82f6', icon: 'checkmark-circle' };
      default: return { bg: 'rgba(59,130,246,0.1)', iconBg: 'rgba(59,130,246,0.2)', iconColor: '#3b82f6', icon: 'time' };
    }
  };
  const headerStyle = getHeaderStyle();

  // Show item controls for all active non-instant orders
  const canCheckDeliver = !order.isReadyServe && (order.status === 'preparing' || order.status === 'partially_ready' || order.status === 'ready' || order.status === 'partially_delivered');

  // Status badge label
  const getBadgeLabel = () => {
    if (order.isReadyServe) return 'Ready to Serve';
    return sc?.label || order.status;
  };
  const getBadgeColor = () => {
    if (order.isReadyServe) return { text: '#f97316', bg: 'rgba(249,115,22,0.12)' };
    return { text: sc?.text || '#f59e0b', bg: sc?.bg || 'rgba(245,158,11,0.12)' };
  };
  const badge = getBadgeColor();

  const displayTotal = (order as any)._splitView
    ? order.items.reduce((sum, i) => sum + (i.offerPrice || i.price) * i.quantity, 0)
    : order.total;

  return (
    <View style={[styles.orderCard, (order.isReadyServe || order.status === 'ready') && styles.orderCardWithTick]}>
      {/* Card content */}
      <View style={styles.cardContent}>
        {/* Header: token + time + status + total */}
        <View style={styles.cardHeader}>
          <Text style={styles.tokenText}>#{order.pickupToken}</Text>
          <Text style={styles.timeText}>{timeSince}</Text>
          <Text style={styles.customerName} numberOfLines={1}>{order.userName || '—'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{getBadgeLabel()}</Text>
          </View>
          <Text style={styles.totalValue}>₹{displayTotal}</Text>
        </View>

      {/* Items */}
      {order.items.map((item, idx) => {
        const iStatus = item.itemStatus || 'preparing';
        const isReady = iStatus === 'ready';
        const isItemDelivered = iStatus === 'delivered';
        const apiIdx = (item as any)._originalIdx ?? idx;
        return (
          <View key={apiIdx} style={styles.itemRow}>
            {canCheckDeliver && (
              <TouchableOpacity
                onPress={() => { onItemDelivered(order.id, apiIdx); }}
                style={styles.checkboxBtn}
                disabled={isItemDelivered}
                accessibilityLabel={
                  isItemDelivered ? `${item.name} delivered` :
                  isReady ? `Deliver ${item.name}` :
                  `Mark ${item.name} ready`
                }
                accessibilityRole="button"
              >
                <Icon
                  name={isItemDelivered ? 'checkmark-circle' : isReady ? 'checkbox' : 'square-outline'}
                  size={16}
                  color={isItemDelivered ? '#22c55e' : isReady ? '#3b82f6' : colors.mutedForeground}
                />
              </TouchableOpacity>
            )}
            {resolveImageUrl(item.image) ? (
              <Image source={{ uri: resolveImageUrl(item.image)! }} style={styles.itemImg} accessibilityLabel={`${item.name} image`} />
            ) : (
              <View style={styles.itemImgPlaceholder}>
                <Icon name="restaurant-outline" size={10} color={colors.mutedForeground} />
              </View>
            )}
            <Text style={[styles.itemName, isItemDelivered && styles.itemDone]} numberOfLines={1}>
              {item.quantity}x {item.name}
            </Text>
            {isReady && <Text style={styles.readyTag}>READY</Text>}
            {isItemDelivered && <Text style={styles.doneTag}>DONE</Text>}
            <Text style={styles.itemPrice}>₹{(item.offerPrice || item.price) * item.quantity}</Text>
          </View>
        );
      })}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {order.status === 'pending' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.startBtn]}
              onPress={() => { mediumHaptic(); onStatusUpdate(order.id, 'preparing'); }}
              disabled={isUpdating}
              activeOpacity={0.7}
              accessibilityLabel="Start preparing"
              accessibilityRole="button"
            >
              {isUpdating ? <ActivityIndicator size="small" color="#fff" /> :
                <Text style={styles.startBtnText}>Start Preparing</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => { mediumHaptic(); onReject(order.id, order.pickupToken); }}
              disabled={isUpdating}
              activeOpacity={0.7}
              accessibilityLabel="Reject order"
              accessibilityRole="button"
            >
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
        {/* Ready orders use tick strip — no button needed here */}
        {order.status === 'partially_delivered' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.completeBtn]}
            onPress={() => { mediumHaptic(); onStatusUpdate(order.id, 'completed'); }}
            disabled={isUpdating}
            activeOpacity={0.7}
            accessibilityLabel="Complete all items"
            accessibilityRole="button"
          >
            {isUpdating ? <ActivityIndicator size="small" color="#fff" /> :
              <Text style={styles.completeBtnText}>Complete All</Text>}
          </TouchableOpacity>
        )}
      </View>
      </View>

      {/* Tick strip for ready-to-serve and ready orders */}
      {(order.isReadyServe || order.status === 'ready') && (
        <TouchableOpacity
          style={styles.tickStrip}
          onPress={() => { mediumHaptic(); onStatusUpdate(order.id, 'completed'); }}
          disabled={isUpdating}
          activeOpacity={0.7}
          accessibilityLabel="Mark order completed"
          accessibilityRole="button"
        >
          {isUpdating ? <ActivityIndicator size="small" color="#fff" /> :
            <Icon name="checkmark" size={20} color="#fff" />}
        </TouchableOpacity>
      )}
    </View>
  );
});

/* ─── Styles ─── */
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Overview Card - BLUE
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

  // Compact order card
  orderCard: {
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginBottom: 6, overflow: 'hidden',
  },
  orderCardWithTick: {
    flexDirection: 'row',
  },
  cardContent: {
    flex: 1, paddingHorizontal: 10, paddingVertical: 6,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 3,
  },
  tokenText: { fontSize: 16, fontWeight: '800', color: colors.foreground, marginRight: 4 },
  timeText: { fontSize: 11, color: colors.mutedForeground, marginRight: 6 },
  customerName: { flex: 1, fontSize: 13, color: colors.mutedForeground, marginRight: 4 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginRight: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  totalValue: { fontSize: 15, fontWeight: '800', color: colors.accent },
  tickStrip: {
    width: 40, backgroundColor: '#22c55e',
    justifyContent: 'center', alignItems: 'center',
  },

  // Items
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 3,
  },
  checkboxBtn: { marginRight: 5 },
  itemImg: { width: 24, height: 24, borderRadius: 6, marginRight: 6 },
  itemImgPlaceholder: {
    width: 24, height: 24, borderRadius: 6, backgroundColor: colors.muted,
    justifyContent: 'center', alignItems: 'center', marginRight: 6,
  },
  itemName: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.foreground },
  itemDone: { textDecorationLine: 'line-through', color: colors.mutedForeground },
  readyTag: { fontSize: 10, fontWeight: '700', color: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
  doneTag: { fontSize: 10, fontWeight: '700', color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
  itemPrice: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground, marginLeft: 6 },

  // Actions
  actionRow: { flexDirection: 'row', marginTop: 4, gap: 4 },
  actionBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 7, borderRadius: 8,
  },
  startBtn: { backgroundColor: colors.accent, flex: 1 },
  startBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  rejectBtn: {
    paddingHorizontal: 14, borderWidth: 1, borderColor: colors.destructive,
    backgroundColor: 'transparent', borderRadius: 8,
  },
  rejectText: { fontSize: 14, fontWeight: '700', color: colors.destructive },
  completeBtn: { backgroundColor: '#22c55e', paddingHorizontal: 14 },
  completeBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  actionText: { fontSize: 13, fontWeight: '600' },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  emptySubtitle: { fontSize: 13, color: colors.mutedForeground },

  // Swipeable card
  swipeContainer: {
    marginBottom: 6, borderRadius: 12, overflow: 'hidden',
  },
  swipeBgFull: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12, justifyContent: 'center',
  },
  swipeBgContent: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
  },
  swipeBgText: { color: '#fff', fontWeight: '800', fontSize: 15, marginHorizontal: 8 },
  swipeCard: {
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  swipeHint: { alignItems: 'center', paddingTop: 4, paddingBottom: 2 },
  swipeHintText: { fontSize: 9, color: colors.mutedForeground, letterSpacing: 0.5 },

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

  // Partial Pickup Overlay (iOS feature)
  partialOverlay: {
    flex: 1, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  partialOverlayContent: { alignItems: 'center', maxWidth: 320 },
  partialIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  partialTitle: {
    fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8,
  },
  partialToken: {
    fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 4, marginBottom: 16,
  },
  partialSubtitle: {
    fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22, marginBottom: 32,
  },
  partialDismissBtn: {
    backgroundColor: '#fff', paddingHorizontal: 40, paddingVertical: 16, borderRadius: 16,
  },
  partialDismissText: {
    fontSize: 16, fontWeight: '800', color: '#3b82f6', letterSpacing: 1,
  },

});
