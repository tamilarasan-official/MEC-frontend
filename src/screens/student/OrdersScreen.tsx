import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, ActivityIndicator,
  Animated, Easing,
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
  partially_ready: { icon: 'git-branch-outline', label: 'Partially Ready', bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
  ready: { icon: 'checkmark-circle-outline', label: 'Ready for Pickup', bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  partially_delivered: { icon: 'cube-outline', label: 'Partial Pickup', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
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

/** Animated empty state for first-time users / no active orders */
const EmptyOrdersState = React.memo(({ colors, styles: s, onStartOrdering }: { colors: any; styles: any; onStartOrdering: () => void }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const arrowBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowBounce, { toValue: 8, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(arrowBounce, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[s.empty, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Animated.View style={[s.emptyIconOuter, { transform: [{ scale: pulseAnim }] }]}>
        <View style={s.emptyIconInner}>
          <Icon name="bag-handle-outline" size={40} color={colors.accent} />
        </View>
      </Animated.View>

      <Text style={s.emptyTitle}>No active orders</Text>
      <Text style={s.emptySub}>
        Your orders will appear here once you{'\n'}place one from the menu
      </Text>

      <TouchableOpacity style={s.startBtn} onPress={onStartOrdering} activeOpacity={0.85} accessibilityLabel="Start ordering" accessibilityRole="button">
        <Text style={s.startBtnText}>Start Ordering</Text>
        <Animated.View style={{ transform: [{ translateX: arrowBounce }] }}>
          <Icon name="arrow-forward" size={18} color="#fff" />
        </Animated.View>
      </TouchableOpacity>

      <View style={s.emptyHintRow}>
        <Icon name="flash-outline" size={14} color={colors.textMuted} />
        <Text style={s.emptyHint}>Orders are tracked in real-time</Text>
      </View>
    </Animated.View>
  );
});

export default function OrdersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const user = useAppSelector(s => s.auth.user);
  const { orders: myOrders, isLoading: loading } = useAppSelector(s => s.orders);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder = useMemo(() => selectedOrderId ? (myOrders ?? []).find(o => o.id === selectedOrderId) ?? null : null, [selectedOrderId, myOrders]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Auto-refresh orders on focus and every 15 seconds while focused
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchMyOrders());
      const interval = setInterval(() => {
        dispatch(fetchMyOrders());
      }, 15000);
      return () => clearInterval(interval);
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
          <EmptyOrdersState colors={colors} styles={styles} onStartOrdering={() => navigation.getParent()?.navigate('Home')} />
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
                      <TouchableOpacity onPress={() => { mediumHaptic(); setSelectedOrderId(order.id); }} activeOpacity={0.9} style={styles.tokenWrap} accessibilityLabel="Show pickup QR code" accessibilityRole="button">
                        <View style={styles.tokenCard}>
                          <LinearGradient
                            colors={isReady ? ['#f97316', '#f59e0b', '#fb923c'] : ['#10b981', '#06d6a0', '#14b8a6']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                          />
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
                        </View>
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
                  const showItemTag = order.status === 'partially_ready' || order.status === 'partially_delivered';
                  return (
                    <View key={imgKey} style={styles.orderItem}>
                      {imageUri && !imgFailed ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.itemImage}
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
                          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                          {showItemTag && (
                            <View style={[styles.itemStatusTag, iStatus === 'ready' ? styles.itemStatusReady : iStatus === 'delivered' ? styles.itemStatusDelivered : styles.itemStatusPreparing]}>
                              <Text style={[styles.itemStatusTagText, iStatus === 'ready' ? styles.itemStatusReadyText : iStatus === 'delivered' ? styles.itemStatusDeliveredText : styles.itemStatusPreparingText]}>
                                {iStatus === 'ready' ? 'Ready' : iStatus === 'delivered' ? 'Delivered' : 'Preparing'}
                              </Text>
                            </View>
                          )}
                        </View>
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
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Home', { screen: 'OrderHistory' })}
          accessibilityLabel="View order history"
          accessibilityRole="button">
          <Icon name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.historyBtnText}>Order History</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* QR Modal */}
      {selectedOrder && (
        <OrderQRCard order={selectedOrder} onClose={() => setSelectedOrderId(null)} />
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
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 20, gap: 6 },
  emptyIconOuter: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.accent + '10',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: colors.accent + '20', borderStyle: 'dashed',
  },
  emptyIconInner: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.accent + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.accent, paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 16,
  },
  startBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  emptyHintRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20,
    opacity: 0.5,
  },
  emptyHint: { fontSize: 12, color: colors.textMuted },

  // Order Card
  orderCard: {
    backgroundColor: colors.card, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 14,
  },

  // Token Card
  tokenWrap: { marginBottom: 14 },
  tokenCard: { borderRadius: 16, padding: 16, overflow: 'hidden' },
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
  itemQty: { fontSize: 12, color: '#3b82f6', marginTop: 1 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemStatusTag: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  itemStatusReady: { backgroundColor: 'rgba(16,185,129,0.12)' },
  itemStatusReadyText: { color: '#10b981' },
  itemStatusDelivered: { backgroundColor: 'rgba(16,185,129,0.12)' },
  itemStatusDeliveredText: { color: '#10b981' },
  itemStatusPreparing: { backgroundColor: 'rgba(234,179,8,0.12)' },
  itemStatusPreparingText: { color: '#eab308' },
  itemStatusTagText: { fontSize: 10, fontWeight: '700' },

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, marginTop: 12,
    alignSelf: 'center',
  },
  historyBtnText: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  bottomSpacer: { height: 100 },
});
