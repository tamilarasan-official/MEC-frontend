import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchMyOrders } from '../../store/slices/ordersSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import { OrderQRCard } from '../../components/common/OrderQRCard';
import { Order } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';

const ACTIVE_STATUSES = new Set(['pending', 'preparing', 'ready', 'partially_delivered']);

const statusConfig: Record<string, { icon: string; label: string; bg: string; color: string }> = {
  pending: { icon: 'time-outline', label: 'Ordered', bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
  preparing: { icon: 'flame-outline', label: 'Preparing', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  ready: { icon: 'cube-outline', label: 'Ready for Pickup', bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  partially_delivered: { icon: 'checkmark-circle-outline', label: 'Partial Delivery', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  completed: { icon: 'checkmark-done-outline', label: 'Delivered', bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  cancelled: { icon: 'close-circle-outline', label: 'Cancelled', bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
};

export default function OrdersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { orders: myOrders, isLoading: loading } = useAppSelector(s => s.orders);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => { dispatch(fetchMyOrders()); }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchMyOrders());
    setRefreshing(false);
  };

  // Show active orders, or last completed
  const displayOrders = useMemo(() => {
    const sorted = [...myOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const active = sorted.filter(o => ACTIVE_STATUSES.has(o.status));
    if (active.length > 0) return active;
    const last = sorted.find(o => o.status === 'completed');
    return last ? [last] : [];
  }, [myOrders]);

  if (loading && !refreshing) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Orders</Text>
          <Text style={styles.subtitle}>Track your active orders</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Icon name="refresh" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {displayOrders.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="cube-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No active orders</Text>
            <Text style={styles.emptySub}>Place an order to get started</Text>
          </View>
        ) : (
          displayOrders.map((order, _index) => {
            const sc = statusConfig[order.status] || statusConfig.pending;
            return (
              <View key={order.id} style={styles.orderCard}>
                {/* Pickup Token */}
                {order.status !== 'completed' && order.status !== 'cancelled' && order.pickupToken && (
                  <TouchableOpacity style={styles.tokenCard} onPress={() => setSelectedOrder(order)} activeOpacity={0.9}>
                    <View style={styles.tokenContent}>
                      <View>
                        <Text style={styles.tokenLabel}>Pickup Token</Text>
                        <Text style={styles.tokenValue}>{order.pickupToken}</Text>
                      </View>
                      <View style={styles.tokenQR}>
                        <Icon name="qr-code" size={28} color="#fff" />
                      </View>
                    </View>
                    <Text style={styles.tokenHint}>Tap to show QR at counter</Text>
                  </TouchableOpacity>
                )}

                {/* Order Info */}
                <View style={styles.orderHeader}>
                  <View style={styles.flex1}>
                    <Text style={styles.orderDate}>
                      {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Icon name={sc.icon} size={14} color={sc.color} />
                    <Text style={[styles.statusLabel, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>

                {/* Items */}
                {order.items.map((item: any, idx: number) => (
                  <View key={`${order.id}-${idx}`} style={styles.orderItem}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.itemImage} />
                    ) : (
                      <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                        <Icon name="restaurant-outline" size={16} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.flex1}>
                      <Text style={styles.itemQty}>x{item.quantity}</Text>
                    </View>
                    <Text style={styles.itemPrice}>Rs. {(item.offerPrice ?? item.price) * item.quantity}</Text>
                  </View>
                ))}

                <View style={styles.orderFooter}>
                  <Text style={styles.orderTotalLabel}>Total</Text>
                  <Text style={styles.orderTotalValue}>Rs. {order.total}</Text>
                </View>
              </View>
            );
          })
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* QR Modal */}
      {selectedOrder && (
        <OrderQRCard order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </View>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: colors.textMuted },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  refreshBtn: { padding: 10, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  list: { padding: 16, paddingTop: 0 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  emptySub: { fontSize: 13, color: colors.textMuted },
  orderCard: { backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  tokenCard: {
    borderRadius: 16, padding: 16, marginBottom: 12, overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  tokenContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tokenLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  tokenValue: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 4, marginTop: 2 },
  tokenQR: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  tokenHint: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 10 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderId: { fontSize: 14, fontWeight: '600', color: colors.text },
  orderDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusLabel: { fontSize: 11, fontWeight: '600' },
  orderItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  itemImage: { width: 44, height: 44, borderRadius: 10 },
  itemName: { fontSize: 13, fontWeight: '500', color: colors.text },
  itemQty: { fontSize: 11, color: colors.textMuted },
  itemPrice: { fontSize: 13, fontWeight: '500', color: colors.text },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  orderTotalLabel: { fontSize: 13, color: colors.textMuted },
  orderTotalValue: { fontSize: 16, fontWeight: '700', color: colors.primary },
  flex1: { flex: 1 },
  itemImagePlaceholder: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  bottomSpacer: { height: 100 },
});
