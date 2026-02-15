import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import Icon from '../../components/common/Icon';
import { colors, statusColors } from '../../theme/colors';
import orderService from '../../services/orderService';
import { Order } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type HistoryFilter = 'completed' | 'cancelled';

export default function CaptainHistoryScreen() {
  const [filter, setFilter] = useState<HistoryFilter>('completed');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const historyResult = await orderService.getOrderHistory?.();
      const data = historyResult
        ? [...(historyResult.completed || []), ...(historyResult.cancelled || [])]
        : await orderService.getShopOrders();
      setOrders(data || []);
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

  const filtered = orders.filter(o => o.status === filter);

  const renderOrder = ({ item: order }: { item: Order }) => {
    const sc = statusColors[order.status];
    return (
      <View style={styles.orderCard}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.tokenText}>#{order.pickupToken}</Text>
            <Text style={styles.dateText}>
              {new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc?.bg || colors.successBg }]}>
            <Text style={[styles.statusText, { color: sc?.text || colors.primary }]}>
              {sc?.label || order.status}
            </Text>
          </View>
        </View>

        <View style={styles.customerRow}>
          <Icon name="person-outline" size={14} color={colors.mutedForeground} />
          <Text style={styles.customerName}>{order.userName}</Text>
        </View>

        <View style={styles.itemsList}>
          {order.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.quantity}x</Text>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemPrice}>Rs.{(item.offerPrice || item.price) * item.quantity}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>Rs.{order.total}</Text>
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
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Order History</Text>
      </View>

      {/* Filter toggle */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'completed' && styles.filterActive]}
          onPress={() => setFilter('completed')}
        >
          <Icon name="checkmark-circle" size={14} color={filter === 'completed' ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.filterLabel, filter === 'completed' && { color: colors.primary }]}>Completed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'cancelled' && styles.filterActive]}
          onPress={() => setFilter('cancelled')}
        >
          <Icon name="close-circle" size={14} color={filter === 'cancelled' ? colors.destructive : colors.mutedForeground} />
          <Text style={[styles.filterLabel, filter === 'cancelled' && { color: colors.destructive }]}>Cancelled</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderOrder}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="document-text-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No {filter} orders</Text>
            <Text style={styles.emptySubtitle}>Past orders will appear here</Text>
          </View>
        }
      />
    </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.foreground },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4,
  },
  filterTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterActive: {
    borderColor: colors.primary, backgroundColor: colors.successBg,
  },
  filterLabel: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  orderCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8,
  },
  tokenText: { fontSize: 16, fontWeight: '800', color: colors.foreground, fontFamily: 'monospace' },
  dateText: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  customerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  customerName: { fontSize: 13, color: colors.mutedForeground },
  itemsList: { marginBottom: 8 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 3,
  },
  itemQty: { fontSize: 12, fontWeight: '600', color: colors.primary, width: 28 },
  itemName: { fontSize: 13, color: colors.foreground, flex: 1 },
  itemPrice: { fontSize: 12, color: colors.mutedForeground },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  totalValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  emptySubtitle: { fontSize: 13, color: colors.mutedForeground },
});
