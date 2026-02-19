import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Icon from './Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { Order } from '../../types';

interface OrderQRCardProps {
  order: Order;
  onClose: () => void;
}

export function OrderQRCard({ order, onClose }: OrderQRCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusMeta: Record<string, { label: string; icon: string; color: string; bg: string }> = useMemo(() => ({
    pending: { label: 'Order Placed', icon: 'time-outline', color: colors.amber[500], bg: colors.warningBg },
    preparing: { label: 'Preparing', icon: 'restaurant-outline', color: colors.blue[400], bg: colors.blueBg },
    ready: { label: 'Ready for Pickup', icon: 'cube-outline', color: colors.orange[500], bg: colors.orangeBg },
    completed: { label: 'Completed', icon: 'checkmark-circle', color: colors.primary, bg: colors.successBg },
    cancelled: { label: 'Cancelled', icon: 'close-circle', color: colors.destructive, bg: colors.errorBg },
  }), [colors]);
  const [showDetails, setShowDetails] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const slideAnim = useState(new Animated.Value(300))[0];

  useEffect(() => {
    setCurrentStatus(order.status);
  }, [order.status]);

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = statusMeta[currentStatus] || statusMeta.pending;
  const isReady = currentStatus === 'ready';

  const qrValue = useMemo(() => {
    try {
      // Encode order info for QR code (JSON string is sufficient for QR)
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
            {/* QR */}
            <View style={styles.qrWrapper}>
              <View style={styles.qrGradientBorder}>
                <View style={styles.qrInner}>
                  <QRCode value={qrValue} size={120} backgroundColor="#fff" color="#000" />
                </View>
              </View>
            </View>

            {/* Token */}
            <View style={styles.tokenInfo}>
              <Text style={styles.tokenLabel}>PICKUP TOKEN</Text>
              <Text style={[styles.tokenValue, isReady && { color: colors.primary }]}>
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
              {order.items.map((item, idx) => (
                <View key={idx} style={styles.detailItem}>
                  <View style={styles.detailItemLeft}>
                    <Text style={styles.detailQty}>{item.quantity}x</Text>
                    <Text style={styles.detailName} numberOfLines={1}>{item.name}</Text>
                  </View>
                  <Text style={styles.detailPrice}>
                    Rs.{((item.offerPrice ?? item.price) * item.quantity)}
                  </Text>
                </View>
              ))}
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
    backgroundColor: colors.primary, // simplified gradient border
  },
  qrInner: { backgroundColor: '#fff', borderRadius: 13, padding: 10 },
  tokenInfo: { flex: 1 },
  tokenLabel: { fontSize: 10, fontWeight: '600', color: colors.mutedForeground, letterSpacing: 2, textTransform: 'uppercase' },
  tokenValue: { fontSize: 42, fontWeight: '900', color: colors.foreground, letterSpacing: 4, marginTop: 4 },
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
  detailItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  dividerTop: { marginTop: 8 },
  bottomBar: {
    borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 20, paddingVertical: 12,
    paddingBottom: 24,
  },
  doneBtn: {
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
