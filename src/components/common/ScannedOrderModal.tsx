import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import Icon from './Icon';
import { colors } from '../../theme/colors';
import orderService from '../../services/orderService';
import { Order, OrderStatus } from '../../types';

interface ScannedOrderModalProps {
  orderId: string;
  onClose: () => void;
  onActionComplete: () => void;
}

const statusConfig: Record<string, { icon: string; color: string; bg: string }> = {
  pending: { icon: 'time-outline', color: colors.amber[500], bg: colors.warningBg },
  preparing: { icon: 'restaurant-outline', color: colors.blue[400], bg: colors.blueBg },
  ready: { icon: 'checkmark-circle', color: colors.green500, bg: colors.greenBg },
  completed: { icon: 'checkmark-done', color: colors.primary, bg: colors.successBg },
  cancelled: { icon: 'close-circle', color: colors.destructive, bg: colors.errorBg },
};

export function ScannedOrderModal({ orderId, onClose, onActionComplete }: ScannedOrderModalProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const slideAnim = useState(new Animated.Value(400))[0];

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchOrder() {
      setLoading(true);
      setError(null);
      if (!/^[0-9a-fA-F]{24}$/.test(orderId)) {
        setError(`Invalid order ID format: "${orderId}". This QR code may be outdated.`);
        setLoading(false);
        return;
      }
      try {
        // Use getMyOrders and find the specific order, or direct endpoint if available
        const res = await orderService.getShopOrders();
        const found = res?.find((o: Order) => o.id === orderId);
        if (!cancelled && found) {
          setOrder(found);
        } else if (!cancelled) {
          setError('Order not found');
        }
      } catch {
        if (!cancelled) setError('Failed to load order');
      }
      if (!cancelled) setLoading(false);
    }
    fetchOrder();
    return () => { cancelled = true; };
  }, [orderId]);

  const handleAction = async (status: OrderStatus) => {
    if (!order) return;
    setActionLoading(true);
    setError(null);
    try {
      await orderService.updateOrderStatus(order.id, status);
      setOrder({ ...order, status });
      onActionComplete();
      if (status === 'completed' || status === 'cancelled') {
        setTimeout(onClose, 600);
      }
    } catch {
      setError('Failed to update order');
    }
    setActionLoading(false);
  };

  const sc = order ? (statusConfig[order.status] || statusConfig.pending) : statusConfig.pending;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.modal, { transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Order Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Icon name="close" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading order...</Text>
            </View>
          )}

          {error && !loading && !order && (
            <View style={styles.center}>
              <View style={[styles.errorCircle]}>
                <Icon name="close-circle" size={28} color={colors.destructive} />
              </View>
              <Text style={styles.errorTitle}>Order Not Found</Text>
              <Text style={styles.errorMsg}>{error}</Text>
            </View>
          )}

          {order && (
            <>
              {/* Token + Status */}
              <View style={styles.tokenRow}>
                <View>
                  <Text style={styles.tokenText}>#{order.pickupToken}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Icon name="time-outline" size={14} color={colors.mutedForeground} />
                    <Text style={styles.dateText}>
                      {new Date(order.createdAt).toLocaleString('en-IN', {
                        hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
                      })}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Icon name={sc.icon} size={14} color={sc.color} />
                  <Text style={[styles.statusLabel, { color: sc.color }]}>{order.status}</Text>
                </View>
              </View>

              {/* Customer */}
              <View style={styles.customerRow}>
                <View style={styles.customerAvatar}>
                  <Icon name="person" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.customerName}>{order.userName}</Text>
                </View>
              </View>

              {/* Items */}
              <Text style={styles.sectionTitle}>Food Items</Text>
              <View style={styles.itemsContainer}>
                {order.items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <View style={styles.itemImg}>
                      <Icon name="restaurant-outline" size={16} color={colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.itemQty}>
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>{item.quantity}x</Text>
                        {' '}@ Rs.{item.offerPrice || item.price}
                      </Text>
                    </View>
                    <Text style={styles.itemTotal}>Rs.{(item.offerPrice || item.price) * item.quantity}</Text>
                  </View>
                ))}
              </View>

              {/* Total */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>Rs.{order.total}</Text>
              </View>

              {error && <Text style={styles.actionError}>{error}</Text>}
            </>
          )}
        </ScrollView>

        {/* Action buttons */}
        {order && (
          <View style={styles.actions}>
            {order.status === 'pending' && (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleAction('cancelled')}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color={colors.destructive} />
                  ) : (
                    <>
                      <Icon name="close-circle" size={16} color={colors.destructive} />
                      <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Reject</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.blue[500], flex: 1 }]}
                  onPress={() => handleAction('preparing')}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="restaurant-outline" size={16} color="#fff" />
                      <Text style={[styles.actionBtnText, { color: '#fff' }]}>Start Preparing</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
            {order.status === 'preparing' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.green500 }]}
                onPress={() => handleAction('ready')}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="checkmark-circle" size={16} color="#fff" />
                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>Mark Ready</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {order.status === 'ready' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleAction('completed')}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="checkmark-done" size={18} color="#fff" />
                    <Text style={[styles.actionBtnText, { color: '#fff', fontSize: 16, fontWeight: '700' }]}>Quick Complete</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {(order.status === 'completed' || order.status === 'cancelled') && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.muted }]} onPress={onClose}>
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modal: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%', borderWidth: 1, borderColor: colors.border,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  closeBtn: { padding: 8, borderRadius: 20, backgroundColor: colors.muted },
  body: { padding: 20 },
  center: { alignItems: 'center', paddingVertical: 48 },
  loadingText: { fontSize: 13, color: colors.mutedForeground, marginTop: 12 },
  errorCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.errorBg,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  errorTitle: { fontSize: 15, fontWeight: '600', color: colors.destructive },
  errorMsg: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 },
  tokenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  tokenText: { fontSize: 28, fontWeight: '800', color: colors.foreground, fontFamily: 'monospace', letterSpacing: 2 },
  dateText: { fontSize: 12, color: colors.mutedForeground },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
  },
  statusLabel: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  customerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: 12, backgroundColor: colors.muted, marginBottom: 16,
  },
  customerAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  customerName: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.mutedForeground,
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
  },
  itemsContainer: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemImg: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: colors.muted,
    justifyContent: 'center', alignItems: 'center',
  },
  itemName: { fontSize: 13, fontWeight: '500', color: colors.foreground },
  itemQty: { fontSize: 12, color: colors.mutedForeground },
  itemTotal: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  totalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 12, backgroundColor: colors.muted,
  },
  totalLabel: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
  actionError: { fontSize: 13, color: colors.destructive, textAlign: 'center', marginTop: 8 },
  actions: {
    padding: 20, borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, flex: 1,
  },
  rejectBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.destructive, backgroundColor: 'transparent',
  },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
});
