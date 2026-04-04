import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { mediumHaptic } from '../../utils/haptics';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchMyOrders } from '../../store/slices/ordersSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import { OrderQRCard } from '../../components/common/OrderQRCard';
import { Order } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { resolveImageUrl } from '../../utils/imageUrl';

const ACTIVE_STATUSES = new Set(['pending', 'preparing', 'partially_ready', 'ready', 'partially_delivered']);

const statusConfig: Record<string, { icon: string; label: string; bg: string; color: string }> = {
  pending: { icon: 'time-outline', label: 'Ordered', bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
  preparing: { icon: 'flame-outline', label: 'Preparing', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  partially_ready: { icon: 'hourglass-outline', label: 'Partially Ready', bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
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

  // Keep QR modal order in sync with Redux so real-time status updates reflect immediately
  // Also detect item-level changes (itemStatus) so per-item tags update in the QR modal
  useEffect(() => {
    if (!selectedOrder) return;
    const fresh = myOrders.find(o => o.id === selectedOrder.id);
    if (!fresh) return;
    const statusChanged = fresh.status !== selectedOrder.status;
    const itemsChanged = fresh.items.some((item, i) =>
      selectedOrder.items[i] && item.itemStatus !== selectedOrder.items[i].itemStatus
    );
    if (statusChanged || itemsChanged) {
      // Auto-dismiss QR card when order is completed or cancelled
      if (fresh.status === 'completed' || fresh.status === 'cancelled') {
        setSelectedOrder(null);
      } else {
        setSelectedOrder(fresh);
      }
    }
  }, [myOrders, selectedOrder]);

  // Auto-refresh orders every time this screen gains focus
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchMyOrders());
    }, [dispatch])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchMyOrders());
    setRefreshing(false);
  };

  const displayOrders = useMemo(() => {
    const sorted = [...(myOrders ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const active = sorted.filter(o => ACTIVE_STATUSES.has(o.status));
    if (active.length > 0) return active;
    const last = sorted.find(o => o.status === 'completed');
    return last ? [last] : [];
  }, [myOrders]);

  const handleImageError = useCallback((itemId: string) => {
    setFailedImages(prev => new Set(prev).add(itemId));
  }, []);

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
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} accessibilityLabel="Refresh orders" accessibilityRole="button">
          <Icon name="refresh" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
        {displayOrders.length === 0 ? (
          <AnimatedEmptyState colors={colors} styles={styles} onStartOrdering={() => navigation.navigate('Home', { screen: 'Dashboard' })} />
        ) : (
          displayOrders.map(order => {
            const sc = statusConfig[order.status] || statusConfig.pending;
            return (
              <View key={order.id} style={styles.orderCard}>
                {/* Pickup Token */}
                {order.status !== 'completed' && order.status !== 'cancelled' && order.pickupToken && (
                  (() => {
                    const isReady = order.isReadyServe || order.status === 'ready' || order.status === 'partially_ready' || order.status === 'partially_delivered';
                    return (
                      <TouchableOpacity onPress={() => { mediumHaptic(); setSelectedOrder(order); }} activeOpacity={0.9} style={styles.tokenWrap} accessibilityLabel="Show pickup QR code" accessibilityRole="button">
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
                  <View style={styles.orderHeaderLeft}>
                    <Text style={styles.orderId} numberOfLines={1}>
                      #{order.orderNumber || order.id.slice(-8)}
                    </Text>
                    {order.isReadyServe && (
                      <View style={styles.instantBadge}>
                        <Icon name="flash" size={11} color="#f97316" />
                        <Text style={styles.instantText}>INSTANT</Text>
                      </View>
                    )}
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
                  const iStatus = item.itemStatus || 'preparing';
                  const isRejected = iStatus === 'rejected';
                  const showItemTag = order.items.length > 1 || isRejected;

                  const tagConfig: Record<string, { label: string; style: any; textStyle: any }> = {
                    ready: { label: 'Ready', style: styles.itemStatusReady, textStyle: styles.itemStatusReadyText },
                    delivered: { label: 'Delivered', style: styles.itemStatusDelivered, textStyle: styles.itemStatusDeliveredText },
                    rejected: { label: 'Rejected', style: styles.itemStatusRejected, textStyle: styles.itemStatusRejectedText },
                    preparing: { label: 'Preparing', style: styles.itemStatusPreparing, textStyle: styles.itemStatusPreparingText },
                    pending: { label: 'Pending', style: styles.itemStatusPreparing, textStyle: styles.itemStatusPreparingText },
                  };
                  const tag = tagConfig[iStatus] || tagConfig.preparing;

                  return (
                    <View key={imgKey} style={styles.orderItem}>
                      {imageUri && !imgFailed ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={[styles.itemImage, isRejected && styles.itemImageRejected]}
                          onError={() => handleImageError(imgKey)}
                          accessibilityLabel={`${item.name} image`}
                        />
                      ) : (
                        <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                          <Icon name="restaurant" size={18} color="#3b82f6" />
                        </View>
                      )}
                      <View style={styles.flex1}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.itemName, isRejected && styles.itemNameRejected]} numberOfLines={1}>{item.name}</Text>
                          {showItemTag && (
                            <View style={[styles.itemStatusTag, tag.style]}>
                              <Text style={[styles.itemStatusTagText, tag.textStyle]}>{tag.label}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.itemQty}>x{item.quantity}</Text>
                        {isRejected && item.refundAmount > 0 && (
                          <Text style={styles.refundText}>Rs. {item.refundAmount} refunded</Text>
                        )}
                      </View>
                      {!isRejected && (
                        <Text style={styles.itemPrice}>Rs. {(item.offerPrice ?? item.price) * item.quantity}</Text>
                      )}
                    </View>
                  );
                })}

                {/* Total — adjusted for refunds */}
                {(() => {
                  const refundTotal = order.items
                    .filter((i: any) => i.itemStatus === 'rejected' && i.refundAmount)
                    .reduce((sum: number, i: any) => sum + (i.refundAmount ?? 0), 0);
                  const effectiveTotal = order.total - refundTotal;
                  return (
                    <View style={styles.orderFooter}>
                      {refundTotal > 0 && (
                        <>
                          <View style={styles.refundBreakdownRow}>
                            <Text style={styles.orderTotalLabel}>Order Total</Text>
                            <Text style={styles.orderTotalLabel}>Rs. {order.total}</Text>
                          </View>
                          <View style={styles.refundBreakdownRow}>
                            <Text style={styles.refundLabel}>Refunded</Text>
                            <Text style={styles.refundValue}>- Rs. {refundTotal}</Text>
                          </View>
                        </>
                      )}
                      <View style={styles.totalFinalRow}>
                        <Text style={styles.orderTotalLabel}>{refundTotal > 0 ? 'Paid' : 'Total'}</Text>
                        <Text style={styles.orderTotalValue}>Rs. {effectiveTotal > 0 ? effectiveTotal : 0}</Text>
                      </View>
                    </View>
                  );
                })()}
              </View>
            );
          })
        )}

        {/* View Order History */}
        <TouchableOpacity
          style={styles.historyLink}
          activeOpacity={0.6}
          onPress={() => navigation.navigate('Home', { screen: 'OrderHistory' })}
          accessibilityLabel="View order history"
          accessibilityRole="button">
          <Icon name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.historyLinkText}>View Order History</Text>
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

/* ─── Animated Empty State ─── */
function AnimatedEmptyState({ colors, styles, onStartOrdering }: { colors: any; styles: any; onStartOrdering: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 6, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[styles.empty, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Animated.View style={[styles.emptyPulseOuter, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.emptyPulseInner}>
          <Icon name="bag-handle-outline" size={32} color={colors.accent} />
        </View>
      </Animated.View>
      <Text style={styles.emptyTitle}>No active orders</Text>
      <Text style={styles.emptySub}>Your orders will appear here once you place one from the menu</Text>
      <TouchableOpacity style={styles.startOrderBtn} onPress={onStartOrdering} activeOpacity={0.8}>
        <Text style={styles.startOrderText}>Start Ordering</Text>
        <Animated.View style={{ transform: [{ translateX: arrowAnim }] }}>
          <Icon name="arrow-forward" size={18} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
      <View style={styles.hintRow}>
        <Icon name="flash-outline" size={14} color={colors.textMuted} />
        <Text style={styles.hintText}>Orders are tracked in real-time</Text>
      </View>
    </Animated.View>
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

  // Empty — animated
  empty: { alignItems: 'center', paddingTop: 50, gap: 10, paddingHorizontal: 20 },
  emptyPulseOuter: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.accent + '40',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  emptyPulseInner: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.accent + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  startOrderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.accent, paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 16, marginTop: 8,
  },
  startOrderText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, opacity: 0.5 },
  hintText: { fontSize: 12, color: colors.textMuted },

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
    marginBottom: 14, gap: 8,
  },
  orderHeaderLeft: {
    flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6,
  },
  orderId: { fontSize: 13, fontWeight: '600', color: colors.text },
  instantBadge: {
    backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  instantText: { fontSize: 10, fontWeight: '700', color: '#f97316' },
  orderDate: { fontSize: 12, color: colors.textMuted, width: '100%', marginTop: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, flexShrink: 0,
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
  itemName: { fontSize: 14, fontWeight: '500', color: colors.text, flexShrink: 1 },
  itemNameRejected: { textDecorationLine: 'line-through', color: colors.textMuted },
  itemQty: { fontSize: 12, color: '#3b82f6', marginTop: 1 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemImageRejected: { opacity: 0.4 },
  refundText: { fontSize: 11, color: '#22c55e', marginTop: 2 },
  itemStatusTag: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  itemStatusReady: { backgroundColor: 'rgba(16,185,129,0.12)' },
  itemStatusReadyText: { color: '#10b981' },
  itemStatusDelivered: { backgroundColor: 'rgba(16,185,129,0.12)' },
  itemStatusDeliveredText: { color: '#10b981' },
  itemStatusPreparing: { backgroundColor: 'rgba(234,179,8,0.12)' },
  itemStatusPreparingText: { color: '#eab308' },
  itemStatusRejected: { backgroundColor: 'rgba(239,68,68,0.12)' },
  itemStatusRejectedText: { color: '#ef4444' },
  itemStatusTagText: { fontSize: 10, fontWeight: '700' },

  // Footer
  orderFooter: {
    marginTop: 10, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  refundBreakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4,
  },
  refundLabel: { fontSize: 12, color: '#22c55e' },
  refundValue: { fontSize: 12, fontWeight: '600', color: '#22c55e' },
  totalFinalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4,
  },
  orderTotalLabel: { fontSize: 13, color: colors.textMuted },
  orderTotalValue: { fontSize: 17, fontWeight: '700', color: '#3b82f6' },

  flex1: { flex: 1 },

  // History Link
  historyLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, marginTop: 4,
  },
  historyLinkText: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  bottomSpacer: { height: 100 },
});
