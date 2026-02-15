import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchShopOrders, updateOrderStatus, markItemDelivered } from '../../store/slices/ordersSlice';
import Icon from '../../components/common/Icon';
import { colors, statusColors } from '../../theme/colors';
import { Order, OrderStatus } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type FilterTab = 'all' | 'pending' | 'preparing' | 'ready' | 'partially_delivered';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'preparing', label: 'Cooking' },
  { key: 'ready', label: 'Ready' },
  { key: 'partially_delivered', label: 'Partial' },
];

export default function OwnerOrdersScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const shopOrders = useSelector((s: RootState) => s.orders.shopOrders);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try { await dispatch(fetchShopOrders({})); } finally { setLoading(false); }
  }, [dispatch]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Auto-refresh every 10s
  useEffect(() => {
    const id = setInterval(() => { dispatch(fetchShopOrders({})); }, 10000);
    return () => clearInterval(id);
  }, [dispatch]);

  const onRefresh = async () => { setRefreshing(true); await loadOrders(); setRefreshing(false); };

  const activeOrders = shopOrders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const filtered = filter === 'all'
    ? activeOrders
    : activeOrders.filter(o => o.status === filter);

  // FIFO
  const sorted = [...filtered].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const counts: Record<FilterTab, number> = {
    all: activeOrders.length,
    pending: activeOrders.filter(o => o.status === 'pending').length,
    preparing: activeOrders.filter(o => o.status === 'preparing').length,
    ready: activeOrders.filter(o => o.status === 'ready').length,
    partially_delivered: activeOrders.filter(o => o.status === 'partially_delivered').length,
  };

  const handleStatus = (orderId: string, status: OrderStatus) => {
    dispatch(updateOrderStatus({ orderId, status }));
  };

  const handleItemDelivered = (orderId: string, itemIndex: number) => {
    dispatch(markItemDelivered({ orderId, itemIndex }));
  };

  const timeSince = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  if (loading) {
    return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTER_TABS.map(tab => {
          const active = filter === tab.key;
          const count = counts[tab.key];
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, active && styles.filterTabActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, active && { color: '#fff' }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="receipt-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        ) : (
          sorted.map(order => <OrderCard key={order.id} order={order} onStatus={handleStatus} onItemDelivered={handleItemDelivered} timeSince={timeSince} />)
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
    </ScreenWrapper>
  );
}

function OrderCard({
  order, onStatus, onItemDelivered, timeSince,
}: {
  order: Order;
  onStatus: (id: string, s: OrderStatus) => void;
  onItemDelivered: (oid: string, idx: number) => void;
  timeSince: (d: string) => string;
}) {
  const sc = statusColors[order.status];
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.tokenText}>#{order.pickupToken}</Text>
          <Text style={styles.timeText}>{timeSince(order.createdAt)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc?.bg || colors.warningBg }]}>
          <Text style={[styles.statusBadgeText, { color: sc?.text || colors.amber[500] }]}>
            {sc?.label || order.status}
          </Text>
        </View>
      </View>

      {/* Customer */}
      <View style={styles.customerRow}>
        <Icon name="person-outline" size={14} color={colors.mutedForeground} />
        <Text style={styles.customerName}>{order.userName}</Text>
      </View>

      {/* Items */}
      <View style={styles.itemsList}>
        {order.items.map((item, i) => {
          const canCheckbox = ['preparing', 'partially_delivered'].includes(order.status);
          return (
            <View key={i} style={styles.itemRow}>
              {canCheckbox && (
                <TouchableOpacity
                  onPress={() => onItemDelivered(order.id, i)}
                  style={[styles.checkbox, item.delivered && styles.checkboxChecked]}
                >
                  {item.delivered && <Icon name="checkmark" size={12} color="#fff" />}
                </TouchableOpacity>
              )}
              <Text style={[styles.itemName, item.delivered && styles.itemDelivered]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.itemQty}>×{item.quantity}</Text>
              <Text style={styles.itemPrice}>Rs.{(item.offerPrice ?? item.price) * item.quantity}</Text>
            </View>
          );
        })}
      </View>

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>Rs.{order.total}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {order.status === 'pending' && (
          <>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => onStatus(order.id, 'cancelled')}>
              <Icon name="close" size={16} color={colors.destructive} />
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => onStatus(order.id, 'preparing')}>
              <Icon name="flame-outline" size={16} color="#fff" />
              <Text style={styles.acceptText}>Start Preparing</Text>
            </TouchableOpacity>
          </>
        )}
        {order.status === 'preparing' && (
          <TouchableOpacity style={styles.readyBtn} onPress={() => onStatus(order.id, 'ready')}>
            <Icon name="checkmark-circle-outline" size={16} color="#fff" />
            <Text style={styles.acceptText}>Mark Ready</Text>
          </TouchableOpacity>
        )}
        {order.status === 'ready' && (
          <TouchableOpacity style={styles.completeBtn} onPress={() => onStatus(order.id, 'completed')}>
            <Icon name="bag-check-outline" size={16} color="#fff" />
            <Text style={styles.acceptText}>Complete</Text>
          </TouchableOpacity>
        )}
        {order.status === 'partially_delivered' && (
          <TouchableOpacity style={styles.completeBtn} onPress={() => onStatus(order.id, 'completed')}>
            <Icon name="checkmark-done-outline" size={16} color="#fff" />
            <Text style={styles.acceptText}>Complete All</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  filterTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterLabel: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  filterLabelActive: { color: '#fff' },
  filterBadge: { backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeText: { fontSize: 10, fontWeight: '800', color: colors.mutedForeground },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 14, color: colors.mutedForeground, marginTop: 12 },
  card: {
    backgroundColor: colors.card, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tokenText: { fontSize: 20, fontWeight: '900', color: colors.foreground, fontFamily: 'monospace' },
  timeText: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  customerName: { fontSize: 13, color: colors.mutedForeground },
  itemsList: { marginBottom: 10 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  itemName: { flex: 1, fontSize: 13, color: colors.foreground },
  itemDelivered: { textDecorationLine: 'line-through', color: colors.mutedForeground },
  itemQty: { fontSize: 12, color: colors.mutedForeground, marginHorizontal: 8 },
  itemPrice: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8,
    borderTopWidth: 1, borderTopColor: colors.border, marginBottom: 10,
  },
  totalLabel: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  totalAmount: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  actionRow: { flexDirection: 'row', gap: 8 },
  rejectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: colors.destructive,
  },
  rejectText: { fontSize: 13, fontWeight: '600', color: colors.destructive },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, borderRadius: 12, backgroundColor: colors.amber[500],
  },
  acceptText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  readyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, borderRadius: 12, backgroundColor: colors.orange[500],
  },
  completeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary,
  },
});
