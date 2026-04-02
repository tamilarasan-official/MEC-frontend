import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated, DeviceEventEmitter,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Icon from './Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchMyActiveOrders, fetchMyOrders } from '../../store/slices/ordersSlice';
import { Order } from '../../types';
import { ORDER_STATUS_POPUP_EVENT } from '../../constants/events';
import orderService from '../../services/orderService';
import { useSecureScreen } from '../../utils/useSecureScreen';

interface OrderQRCardProps {
  order: Order;
  onClose: () => void;
}

export function OrderQRCard({ order, onClose }: OrderQRCardProps) {
  useSecureScreen();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const statusMeta: Record<string, { label: string; icon: string; color: string; bg: string }> = useMemo(() => ({
    pending: { label: 'Order Placed', icon: 'time-outline', color: colors.amber[500], bg: colors.warningBg },
    preparing: { label: 'Preparing', icon: 'restaurant-outline', color: colors.blue[400], bg: colors.blueBg },
    ready: { label: 'Ready for Pickup', icon: 'cube-outline', color: colors.orange[500], bg: colors.orangeBg },
    partially_ready: { label: 'Partially Ready', icon: 'git-branch-outline', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    partially_delivered: { label: 'Partial Pickup', icon: 'cube-outline', color: colors.blue[400], bg: colors.blueBg },
    completed: { label: 'Completed', icon: 'checkmark-circle', color: colors.primary, bg: colors.successBg },
    cancelled: { label: 'Cancelled', icon: 'close-circle', color: colors.destructive, bg: colors.errorBg },
  }), [colors]);
  // Auto-expand details when partially_ready so student sees which items are ready
  const [showDetails, setShowDetails] = useState(order.status === 'partially_ready' || order.status === 'partially_delivered');
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const slideAnim = useState(new Animated.Value(300))[0];
  const prevStatusRef = useRef(order.status);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Sync status from prop changes
  useEffect(() => {
    if (order.status !== currentStatus) {
      setCurrentStatus(order.status);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.status]);

  // Subscribe to Redux for real-time status updates
  const activeOrders = useAppSelector(s => s.orders.activeOrders);
  const reduxOrders = useAppSelector(s => s.orders.orders);
  useEffect(() => {
    const updated = activeOrders.find(o => o.id === order.id) || reduxOrders.find(o => o.id === order.id);
    if (updated && updated.status !== currentStatus) {
      setCurrentStatus(updated.status);
    }
  }, [activeOrders, reduxOrders, order.id, currentStatus]);

  // Track currentStatus in a ref for polling closures
  const currentStatusRef = useRef(currentStatus);
  useEffect(() => { currentStatusRef.current = currentStatus; }, [currentStatus]);

  // When status changes: close the drawer so the popup (rendered as an
  // absolute View in RootNavigator) can show unblocked. No delay needed --
  // React batches state updates so the popup renders after unmount.
  useEffect(() => {
    if (currentStatus === prevStatusRef.current) return;
    prevStatusRef.current = currentStatus;

    // Refresh both order lists for screens behind the modal
    dispatch(fetchMyOrders());
    dispatch(fetchMyActiveOrders());
    // Close the drawer so the full-screen popup can show unblocked
    onCloseRef.current();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStatus, dispatch]);

  // Poll for order status updates every 8 seconds while the modal is open
  useEffect(() => {
    let mounted = true;

    const pollStatus = async () => {
      try {
        const fresh = await orderService.getOrderById(order.id);
        if (mounted && fresh && fresh.status !== currentStatusRef.current) {
          setCurrentStatus(fresh.status);
        }
      } catch {
        // Silently ignore -- poll will retry
      }
    };

    const interval = setInterval(pollStatus, 8000);
    pollStatus();

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [order.id]);

  // Listen for ORDER_STATUS_POPUP_EVENT -- close the drawer whenever ANY order
  // status popup fires so the full-screen popup (rendered as an absolute View
  // in RootNavigator) is always visible and not hidden behind this Modal.
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(ORDER_STATUS_POPUP_EVENT, (data: { status: string; orderNumber: string }) => {
      // Update status if it's for THIS order
      const orderNum = order.orderNumber || order.pickupToken || order.id.slice(-6);
      if (data.orderNumber === orderNum || data.orderNumber === order.pickupToken) {
        setCurrentStatus(data.status as Order['status']);
      }
      // Always close -- any popup should be visible, not blocked by this Modal
      // No need to dispatch here — socket already triggered the refetch
      onCloseRef.current();
    });
    return () => subscription.remove();
  }, [order.orderNumber, order.pickupToken, order.id, dispatch]);

  // No separate Redux polling needed here — the 8s API poll above + socket events
  // already keep the order status fresh. Redundant polling causes dispatch storms.

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusBase = statusMeta[currentStatus] || statusMeta.pending;
  // For partially_ready, show "1 of 3 Ready" instead of generic label
  const status = currentStatus === 'partially_ready'
    ? { ...statusBase, label: `${order.items.filter(i => (i.itemStatus || 'preparing') === 'ready').length} of ${order.items.length} Ready` }
    : statusBase;
  const isReady = currentStatus === 'ready' || currentStatus === 'partially_ready' || currentStatus === 'partially_delivered';

  const qrValue = useMemo(() => {
    try {
      return JSON.stringify({
        order_id: order.id,
        pickup_token: order.pickupToken,
        shop_id: order.shopId,
      });
    } catch {
      return JSON.stringify({ order_id: order.id, pickup_token: order.pickupToken });
    }
  }, [order.id, order.pickupToken, order.shopId]);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Drag handle */}
        <View style={styles.handleBar}>
          <View style={styles.handle} />
        </View>

        <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.shopName} numberOfLines={1}>{order.shopName || 'Campus Shop'}</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Icon name={status.icon} size={12} color={status.color} />
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* QR + Token side by side */}
          <View style={styles.qrRow}>
            <View style={styles.qrWrapper}>
              <View style={styles.qrGradientBorder}>
                <View style={styles.qrInner}>
                  <QRCode
                    value={qrValue}
                    size={120}
                    backgroundColor="#fff"
                    color="#000"
                    ecl="M"
                    logo={require('../../assets/icons/appicon.png')}
                    logoSize={28}
                    logoBackgroundColor="#fff"
                    logoBorderRadius={8}
                    logoMargin={2}
                  />
                </View>
              </View>
            </View>

            <View style={styles.tokenInfo}>
              <Text style={styles.tokenLabel}>PICKUP TOKEN</Text>
              <Text style={styles.tokenValue}>
                {order.pickupToken}
              </Text>
              <Text style={styles.tokenHint}>
                {isReady ? 'Your order is ready! Show this QR at the counter.' : 'Show this QR code at the counter for pickup'}
              </Text>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>Rs.{order.total}</Text>
              </View>
            </View>
          </View>

          {/* Order Details Toggle */}
          <TouchableOpacity onPress={() => setShowDetails(!showDetails)} style={styles.detailsToggle}>
            <Text style={styles.detailsToggleText}>
              Order Details ({order.items.length} {order.items.length === 1 ? 'item' : 'items'})
            </Text>
            <Icon name={showDetails ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {showDetails && (
            <View style={styles.detailsSection}>
              <View style={styles.divider} />
              {order.items.map((item, idx) => {
                const iStatus = item.itemStatus || 'preparing';
                const showTag = currentStatus === 'partially_ready' || currentStatus === 'partially_delivered';
                return (
                  <View key={idx} style={styles.detailItem}>
                    <View style={styles.detailItemLeft}>
                      <Text style={styles.detailQty}>{item.quantity}x</Text>
                      <Text style={styles.detailName} numberOfLines={1}>{item.name}</Text>
                      {showTag && (
                        <View style={[styles.itemTag, iStatus === 'ready' ? styles.itemTagReady : iStatus === 'delivered' ? styles.itemTagReady : styles.itemTagPreparing]}>
                          <Text style={[styles.itemTagText, iStatus === 'ready' || iStatus === 'delivered' ? styles.itemTagReadyText : styles.itemTagPreparingText]}>
                            {iStatus === 'ready' ? 'Ready' : iStatus === 'delivered' ? 'Done' : 'Preparing'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.detailPrice}>
                      Rs.{((item.offerPrice ?? item.price) * item.quantity)}
                    </Text>
                  </View>
                );
              })}
              <View style={[styles.divider, styles.dividerTop]} />
              <View style={styles.detailItem}>
                <Text style={styles.detailTotalLabel}>Total Paid</Text>
                <Text style={styles.detailTotalValue}>Rs.{order.total}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
                <Text style={[styles.metaText, styles.metaMono]}>
                  #{order.id.slice(-8).toUpperCase()}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Done button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handleBar: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 8 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  shopName: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  closeBtn: { padding: 6, borderRadius: 12, backgroundColor: colors.muted },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  qrWrapper: {},
  qrGradientBorder: {
    padding: 3, borderRadius: 16,
    backgroundColor: '#3b82f6',
  },
  qrInner: { backgroundColor: '#fff', borderRadius: 13, padding: 10 },
  tokenInfo: { flex: 1 },
  tokenLabel: { fontSize: 10, fontWeight: '600', color: colors.mutedForeground, letterSpacing: 2, textTransform: 'uppercase' },
  tokenValue: { fontSize: 42, fontWeight: '900', color: '#3b82f6', letterSpacing: 4, marginTop: 4 },
  tokenHint: { fontSize: 12, color: colors.mutedForeground, marginTop: 6, lineHeight: 16 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10 },
  totalLabel: { fontSize: 12, color: colors.mutedForeground },
  totalAmount: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  detailsToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10,
  },
  detailsToggleText: { fontSize: 13, fontWeight: '500', color: colors.mutedForeground },
  detailsSection: { paddingBottom: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  detailItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  detailQty: { fontSize: 12, fontWeight: '500', color: colors.mutedForeground, width: 26, textAlign: 'right' },
  detailName: { fontSize: 13, color: colors.foreground, flex: 1 },
  detailPrice: { fontSize: 13, color: colors.mutedForeground },
  detailTotalLabel: { fontSize: 13, fontWeight: '500', color: colors.mutedForeground },
  detailTotalValue: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metaText: { fontSize: 11, color: colors.mutedForeground },
  metaMono: { fontFamily: 'monospace' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  detailItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' },
  itemTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  itemTagReady: { backgroundColor: 'rgba(16,185,129,0.15)' },
  itemTagPreparing: { backgroundColor: 'rgba(234,179,8,0.15)' },
  itemTagText: { fontSize: 9, fontWeight: '700' },
  itemTagReadyText: { color: '#10b981' },
  itemTagPreparingText: { color: '#eab308' },
  dividerTop: { marginTop: 8 },
  bottomBar: {
    borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 20, paddingVertical: 12,
    paddingBottom: 24,
  },
  doneBtn: {
    backgroundColor: '#3b82f6', borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
