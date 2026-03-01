import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchMyOrders } from '../../store/slices/ordersSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import { OrderQRCard } from '../../components/common/OrderQRCard';
import { Order } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';

const IMAGE_BASE = 'https://backend.mec.welocalhost.com';
function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${IMAGE_BASE}${url}`;
}

const ACTIVE_STATUSES = new Set(['pending', 'preparing', 'ready', 'partially_delivered']);

const statusConfig: Record<string, { icon: string; label: string; bg: string; color: string }> = {
  pending: { icon: 'time-outline', label: 'Ordered', bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
  preparing: { icon: 'flame-outline', label: 'Preparing', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  ready: { icon: 'checkmark-circle-outline', label: 'Ready for Pickup', bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  partially_delivered: { icon: 'checkmark-circle-outline', label: 'Partial Delivery', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  completed: { icon: 'checkmark-done-outline', label: 'Delivered', bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  cancelled: { icon: 'close-circle-outline', label: 'Cancelled', bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
};

function formatOrderDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = d.toLocaleDateString('en-IN', { month: 'short' });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
  return `${day} ${month} ${year}, ${time}`;
}

export default function OrdersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const user = useAppSelector(s => s.auth.user);
  const { orders: myOrders, isLoading: loading } = useAppSelector(s => s.orders);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  useEffect(() => { dispatch(fetchMyOrders()); }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchMyOrders());
    setRefreshing(false);
  };

  const displayOrders = useMemo(() => {
    const sorted = [...myOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const active = sorted.filter(o => ACTIVE_STATUSES.has(o.status));
    if (active.length > 0) return active;
    const last = sorted.find(o => o.status === 'completed');
    return last ? [last] : [];
  }, [myOrders]);

  const handleImageError = (itemId: string) => {
    setFailedImages(prev => new Set(prev).add(itemId));
  };

  if (loading && !refreshing) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
        {displayOrders.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="cube-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No active orders</Text>
            <Text style={styles.emptySub}>Place an order to get started</Text>
          </View>
        ) : (
          displayOrders.map(order => {
            const sc = statusConfig[order.status] || statusConfig.pending;
            return (
              <View key={order.id} style={styles.orderCard}>
                {/* Pickup Token */}
                {order.status !== 'completed' && order.status !== 'cancelled' && order.pickupToken && (
                  (() => {
                    const isReady = order.isReadyServe || order.status === 'ready' || order.status === 'partially_delivered';
                    return (
                      <TouchableOpacity onPress={() => setSelectedOrder(order)} activeOpacity={0.9} style={styles.tokenWrap}>
                        <LinearGradient
                          colors={isReady ? ['#f97316', '#f59e0b', '#fb923c'] : ['#10b981', '#06d6a0', '#14b8a6']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={styles.tokenCard}>
                          <View style={styles.tokenContent}>
                            <View>
                              <Text style={styles.tokenLabel}>
                                {isReady ? 'READY TO COLLECT' : 'PICKUP TOKEN'}
                              </Text>
                              <Text style={styles.tokenValue}>{order.pickupToken}</Text>
                              <Text style={styles.tokenHint}>Tap to show QR at counter</Text>
                            </View>
                            <View style={styles.tokenQR}>
                              <Icon name={isReady ? 'flash' : 'qr-code'} size={28} color="#fff" />
                            </View>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })()
                )}

                {/* Order ID + Status */}
                <View style={styles.orderHeader}>
                  <View style={styles.flex1}>
                    <Text style={styles.orderId} numberOfLines={1}>#{order.id}</Text>
                    <Text style={styles.orderDate}>{formatOrderDate(order.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Icon name={sc.icon} size={13} color={sc.color} />
                    <Text style={[styles.statusLabel, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>

                {/* Items */}
                {order.items.map((item: any, idx: number) => {
                  const imageUri = resolveImageUrl(item.image);
                  const imgKey = `${order.id}-${idx}`;
                  const imgFailed = failedImages.has(imgKey);
                  return (
                    <View key={imgKey} style={styles.orderItem}>
                      {imageUri && !imgFailed ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.itemImage}
                          onError={() => handleImageError(imgKey)}
                        />
                      ) : (
                        <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                          <Icon name="restaurant" size={18} color="#3b82f6" />
                        </View>
                      )}
                      <View style={styles.flex1}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.itemQty}>x{item.quantity}</Text>
                      </View>
                      <Text style={styles.itemPrice}>Rs. {(item.offerPrice ?? item.price) * item.quantity}</Text>
                    </View>
                  );
                })}

                {/* Total */}
                <View style={styles.orderFooter}>
                  <Text style={styles.orderTotalLabel}>Total</Text>
                  <Text style={styles.orderTotalValue}>Rs. {order.total}</Text>
                </View>
              </View>
            );
          })
        )}

        {/* View Order History */}
        <TouchableOpacity
          style={styles.historyBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Home', { screen: 'OrderHistory' })}>
          <Icon name="time-outline" size={18} color={colors.textMuted} />
          <Text style={styles.historyBtnText}>View Order History</Text>
        </TouchableOpacity>

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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  refreshBtn: {
    padding: 10, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  list: { padding: 16, paddingTop: 0 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  emptySub: { fontSize: 13, color: colors.textMuted },

  // Order Card
  orderCard: {
    backgroundColor: colors.card, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 14,
  },

  // Token Card
  tokenWrap: { marginBottom: 14 },
  tokenCard: { borderRadius: 16, padding: 16 },
  tokenContent: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  tokenLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  tokenValue: {
    fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: 6, marginTop: 4,
  },
  tokenHint: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 8 },
  tokenQR: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Order Header
  orderHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 14,
  },
  orderId: { fontSize: 13, fontWeight: '600', color: colors.text },
  orderDate: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  statusLabel: { fontSize: 11, fontWeight: '600' },

  // Order Items
  orderItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10,
  },
  itemImage: { width: 44, height: 44, borderRadius: 12 },
  itemImagePlaceholder: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  itemName: { fontSize: 14, fontWeight: '500', color: colors.text },
  itemQty: { fontSize: 12, color: '#3b82f6', marginTop: 1 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: colors.text },

  // Footer
  orderFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  orderTotalLabel: { fontSize: 13, color: colors.textMuted },
  orderTotalValue: { fontSize: 17, fontWeight: '700', color: '#3b82f6' },

  flex1: { flex: 1 },

  // History Button
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16, borderRadius: 16, marginTop: 4,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  historyBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  bottomSpacer: { height: 100 },
});
