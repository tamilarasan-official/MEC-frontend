import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchActiveShopOrders, updateOrderStatus, markItemDelivered } from '../../store/slices/ordersSlice';
import Icon from '../../components/common/Icon';
import { colors, statusColors } from '../../theme/colors';
import { Order, OrderStatus } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type FilterStatus = 'pending' | 'preparing' | 'ready' | 'partially_delivered';

const FILTERS: { key: FilterStatus; label: string; icon: string; activeColor: string }[] = [
  { key: 'pending', label: 'Pending', icon: 'time-outline', activeColor: colors.amber[500] },
  { key: 'preparing', label: 'Cooking', icon: 'restaurant-outline', activeColor: colors.blue[500] },
  { key: 'ready', label: 'Ready', icon: 'cube-outline', activeColor: colors.orange[500] },
  { key: 'partially_delivered', label: 'Partial', icon: 'checkmark-done-outline', activeColor: colors.blue[400] },
];

export default function CaptainOrdersScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const shopOrders = useSelector((s: RootState) => s.orders.shopOrders);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      await dispatch(fetchActiveShopOrders());
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

  const filteredOrders = shopOrders
    .filter(o => o.status === filter)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // FIFO

  const getCounts = (status: FilterStatus) => shopOrders.filter(o => o.status === status).length;

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

        {/* Items - with delivery checkboxes for preparing/partially_delivered */}
        <View style={styles.itemsList}>
          {order.items.map((item, idx) => {
            const isDelivered = (item as any).delivered ?? false;
            const showCheckbox = order.status === 'preparing' || order.status === 'partially_delivered';
            return (
              <View key={idx} style={styles.itemRow}>
                {showCheckbox && (
                  <TouchableOpacity
                    onPress={() => !isDelivered && handleItemDelivered(order.id, idx)}
                    style={{ marginRight: 8 }}
                    disabled={isDelivered}
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
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>Rs.{order.total}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {order.status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleStatusUpdate(order.id, 'cancelled')}
                disabled={isUpdating}
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
        {FILTERS.map(f => {
          const count = getCounts(f.key);
          const isActive = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterTab, isActive && { backgroundColor: f.activeColor + '15', borderColor: f.activeColor }]}
              onPress={() => setFilter(f.key)}
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
        keyExtractor={item => item.id}
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
    </ScreenWrapper>
  );
}

function getTimeSince(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

const styles = StyleSheet.create({
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
});
