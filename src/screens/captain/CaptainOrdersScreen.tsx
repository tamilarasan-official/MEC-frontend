import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, AppState, Modal,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchActiveShopOrders, updateOrderStatus, markItemDelivered } from '../../store/slices/ordersSlice';
import Icon from '../../components/common/Icon';
import { statusColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { Order, OrderStatus } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type FilterStatus = 'pending' | 'preparing' | 'partially_ready' | 'ready' | 'partially_delivered';

const BASE_FILTERS: { key: FilterStatus; label: string; icon: string; activeColor: string }[] = [
  { key: 'pending', label: 'Pending', icon: 'time-outline', activeColor: '#f59e0b' },
  { key: 'preparing', label: 'Cooking', icon: 'restaurant-outline', activeColor: '#3b82f6' },
  { key: 'ready', label: 'Ready', icon: 'cube-outline', activeColor: '#f97316' },
  { key: 'partially_delivered', label: 'Partial', icon: 'checkmark-done-outline', activeColor: '#60a5fa' },
];

const PARTIAL_READY_FILTER = { key: 'partially_ready' as FilterStatus, label: 'Partial Ready', icon: 'hourglass-outline', activeColor: '#8b5cf6' };

export default function CaptainOrdersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const shopOrders = useSelector((s: RootState) => s.orders.shopOrders);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Reject order modal state
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; orderId: string; token: string }>({ visible: false, orderId: '', token: '' });
  const [rejectLoading, setRejectLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      await dispatch(fetchActiveShopOrders());
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 5 seconds, pause when app is backgrounded
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => { interval = setInterval(() => dispatch(fetchActiveShopOrders()), 5000); };
    const stopPolling = () => { if (interval) { clearInterval(interval); interval = null; } };
    startPolling();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') startPolling(); else stopPolling();
    });
    return () => { stopPolling(); sub.remove(); };
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const partiallyReadyCount = useMemo(() => shopOrders.filter(o => o.status === 'partially_ready').length, [shopOrders]);

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

  // Split view: partially_ready orders appear in BOTH preparing + partially_ready tabs
  const filteredOrders = useMemo(() => {
    let orders: Order[];
    if (filter === 'partially_ready') {
      orders = shopOrders
        .filter(o => o.status === 'partially_ready')
        .map(o => ({
          ...o,
          _splitView: 'ready' as const,
          items: o.items.map((item, i) => ({ ...item, _originalIdx: i })).filter(i => (i.itemStatus || 'preparing') === 'ready'),
        }))
        .filter(o => o.items.length > 0);
    } else if (filter === 'preparing') {
      const normal = shopOrders.filter(o => o.status === 'preparing');
      const splitPreparing = shopOrders
        .filter(o => o.status === 'partially_ready')
        .map(o => ({
          ...o,
          _splitView: 'preparing' as const,
          items: o.items.map((item, i) => ({ ...item, _originalIdx: i })).filter(i => (i.itemStatus || 'preparing') === 'preparing'),
        }))
        .filter(o => o.items.length > 0);
      orders = [...normal, ...splitPreparing];
    } else {
      orders = shopOrders.filter(o => o.status === filter);
    }
    return orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [shopOrders, filter]);

  const getCounts = (status: FilterStatus) => shopOrders.filter(o => o.status === status).length;

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await dispatch(updateOrderStatus({ orderId, status: newStatus })).unwrap();
    } catch {
      // Silently refresh — order likely already moved by another captain or auto-transition
      dispatch(fetchActiveShopOrders());
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

  const renderOrder = ({ item: order }: { item: Order }) => {
    const isUpdating = updatingId === order.id;
    const timeSince = getTimeSince(new Date(order.createdAt));
    const sc = statusColors[order.status];

    return (
      <View style={styles.orderCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tokenText}>#{order.pickupToken}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Icon name="person-outline" size={12} color={colors.mutedForeground} />
              <Text style={styles.customerName}>{order.userName}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={[styles.statusBadge, { backgroundColor: sc?.bg || colors.warningBg }]}>
              <Text style={[styles.statusText, { color: sc?.text || colors.amber[500] }]}>
                {sc?.label || order.status}
              </Text>
            </View>
            <Text style={styles.timeText}>{timeSince}</Text>
          </View>
        </View>

        {/* Items - with delivery checkboxes for preparing/partially_ready/partially_delivered */}
        <View style={styles.itemsList}>
          {order.items.map((item, idx) => {
            const isDelivered = item.delivered ?? false;
            const showCheckbox = order.status === 'preparing' || order.status === 'partially_ready' || order.status === 'partially_delivered';
            const apiIdx = (item as any)._originalIdx ?? idx;
            return (
              <View key={apiIdx} style={styles.itemRow}>
                {showCheckbox && (
                  <TouchableOpacity
                    onPress={() => !isDelivered && handleItemDelivered(order.id, apiIdx)}
                    style={{ marginRight: 8 }}
                    disabled={isDelivered}
                    accessibilityLabel={isDelivered ? `${item.name} delivered` : `Mark ${item.name} delivered`}
                    accessibilityRole="button"
                  >
                    <Icon
                      name={isDelivered ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={isDelivered ? colors.primary : colors.mutedForeground}
                    />
                  </TouchableOpacity>
                )}
                <View style={styles.itemImgPlaceholder}>
                  <Icon name="restaurant-outline" size={14} color={colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, isDelivered && { textDecorationLine: 'line-through', color: colors.mutedForeground }]}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>{item.quantity}x</Text> @ Rs.{item.offerPrice || item.price}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>Rs.{(item.offerPrice || item.price) * item.quantity}</Text>
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
            Rs.{(order as any)._splitView
              ? order.items.reduce((sum, i) => sum + (i.offerPrice || i.price) * i.quantity, 0)
              : order.total}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {order.status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => setRejectModal({ visible: true, orderId: order.id, token: order.pickupToken })}
                disabled={isUpdating}
                accessibilityLabel="Reject order"
                accessibilityRole="button"
              >
                {isUpdating ? <ActivityIndicator size="small" color={colors.destructive} /> : (
                  <>
                    <Icon name="close-circle" size={16} color={colors.destructive} />
                    <Text style={[styles.actionText, { color: colors.destructive }]}>Reject</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.blue[500], flex: 2 }]}
                onPress={() => handleStatusUpdate(order.id, 'preparing')}
                disabled={isUpdating}
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
            </>
          )}
          {order.status === 'preparing' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.green500, flex: 1 }]}
              onPress={() => handleStatusUpdate(order.id, 'ready')}
              disabled={isUpdating}
              accessibilityLabel="Mark ready"
              accessibilityRole="button"
            >
              {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Icon name="checkmark-circle" size={16} color="#fff" />
                  <Text style={[styles.actionText, { color: '#fff' }]}>Mark Ready</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {order.status === 'ready' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={() => handleStatusUpdate(order.id, 'completed')}
              disabled={isUpdating}
              accessibilityLabel="Complete order"
              accessibilityRole="button"
            >
              {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Icon name="checkmark-done" size={18} color="#fff" />
                  <Text style={[styles.actionText, { color: '#fff', fontWeight: '700' }]}>Complete Order</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {order.status === 'partially_delivered' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={() => handleStatusUpdate(order.id, 'completed')}
              disabled={isUpdating}
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
    );
  };

  if (loading) {
    return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {filters.map(f => {
          const count = getCounts(f.key);
          const isActive = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterTab, isActive && { backgroundColor: f.activeColor + '15', borderColor: f.activeColor }]}
              onPress={() => setFilter(f.key)}
              accessibilityLabel={`Filter ${f.label}`}
              accessibilityRole="button"
            >
              <Icon name={f.icon} size={14} color={isActive ? f.activeColor : colors.mutedForeground} />
              <Text style={[styles.filterLabel, isActive && { color: f.activeColor }]}>{f.label}</Text>
              {count > 0 && (
                <View style={[styles.filterBadge, { backgroundColor: isActive ? f.activeColor : colors.mutedForeground }]}>
                  <Text style={styles.filterBadgeText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={item => `${item.id}-${(item as any)._splitView || 'full'}`}
        renderItem={renderOrder}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="checkmark-circle-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No {filter} orders</Text>
            <Text style={styles.emptySubtitle}>Orders will appear here when available</Text>
          </View>
        }
      />
    </View>

    {/* Reject Order Modal */}
    <Modal visible={rejectModal.visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => !rejectLoading && setRejectModal(prev => ({ ...prev, visible: false }))}>
      <TouchableOpacity style={styles.rejectOverlay} activeOpacity={1} onPress={() => !rejectLoading && setRejectModal(prev => ({ ...prev, visible: false }))}>
        <TouchableOpacity activeOpacity={1} style={styles.rejectDialog}>
          <View style={styles.rejectIconWrap}>
            <Icon name="close-circle" size={28} color="#ef4444" />
          </View>
          <Text style={styles.rejectTitle}>Reject Order</Text>
          <Text style={styles.rejectMessage}>
            Are you sure you want to reject order #{rejectModal.token}? The amount will be refunded to the student's wallet.
          </Text>
          <View style={styles.rejectActions}>
            <TouchableOpacity style={styles.rejectCancelBtn} onPress={() => setRejectModal(prev => ({ ...prev, visible: false }))} disabled={rejectLoading} activeOpacity={0.7} accessibilityLabel="Cancel reject" accessibilityRole="button">
              <Text style={styles.rejectCancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectConfirmBtn}
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
                <Text style={styles.rejectConfirmText}>REJECT</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>

    </ScreenWrapper>
  );
}

function getTimeSince(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 6,
  },
  filterTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterLabel: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
  filterBadge: {
    minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  orderCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  tokenText: { fontSize: 20, fontWeight: '800', color: colors.foreground, fontFamily: 'monospace' },
  customerName: { fontSize: 12, color: colors.mutedForeground },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  timeText: { fontSize: 10, color: colors.mutedForeground, marginTop: 4 },
  itemsList: { marginBottom: 12 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemImgPlaceholder: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.muted,
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  itemName: { fontSize: 13, fontWeight: '500', color: colors.foreground },
  itemMeta: { fontSize: 11, color: colors.mutedForeground },
  itemTotal: { fontSize: 12, fontWeight: '600', color: colors.foreground },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.primary },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 14,
  },
  rejectBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.destructive, backgroundColor: 'transparent',
  },
  actionText: { fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  emptySubtitle: { fontSize: 13, color: colors.mutedForeground },

  // Reject modal
  rejectOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  rejectDialog: {
    width: '100%', maxWidth: 320, backgroundColor: colors.card,
    borderRadius: 20, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24,
    elevation: 16,
  },
  rejectIconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(239,68,68,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  rejectTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 8, textAlign: 'center' },
  rejectMessage: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  rejectActions: { flexDirection: 'row', gap: 12, width: '100%' },
  rejectCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.muted, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  rejectCancelText: { fontSize: 14, fontWeight: '700', color: colors.foreground, letterSpacing: 0.5 },
  rejectConfirmBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
  },
  rejectConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
});
