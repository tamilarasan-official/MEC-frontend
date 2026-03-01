import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image,
  ActivityIndicator, Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAppSelector, useAppDispatch } from '../../store';
import { updateQuantity, removeFromCart, clearCart } from '../../store/slices/cartSlice';
import { createOrder } from '../../store/slices/ordersSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../common/Icon';
import { Order } from '../../types';

const IMAGE_BASE = 'https://backend.mec.welocalhost.com';
function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${IMAGE_BASE}${url}`;
}

interface CartBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
  onOrderFailure: (errorMessage?: string) => void;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending:              { bg: 'rgba(234,179,8,0.15)',   color: '#eab308', label: 'Order Placed' },
  preparing:            { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', label: 'Preparing' },
  ready:                { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', label: 'Ready For Pickup' },
  partially_delivered:  { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', label: 'Partial' },
};

export function CartBottomSheet({ visible, onClose, onOrderSuccess, onOrderFailure }: CartBottomSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();

  const { items: cartItems, shopId, shopName } = useAppSelector(s => s.cart);
  const user = useAppSelector(s => s.auth.user);
  const activeOrders = useAppSelector(s => s.orders.activeOrders);
  const [ordering, setOrdering] = useState(false);

  const slideAnim = useMemo(() => new Animated.Value(600), []);

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(600);
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }).start();
    }
  }, [visible, slideAnim]);

  const cartTotal = cartItems.reduce((sum, c) => sum + (c.item.offerPrice ?? c.item.price) * c.quantity, 0);
  const totalCount = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const balance = user?.balance || 0;
  const hasBalance = balance >= cartTotal;

  const handlePay = async () => {
    if (!hasBalance || !shopId || cartItems.length === 0) return;
    const savedTotal = cartTotal;
    const savedShopName = shopName || '';
    setOrdering(true);
    try {
      const result = await dispatch(createOrder({
        shopId,
        items: cartItems.map(c => ({ foodItemId: c.item.id, quantity: c.quantity })),
      })).unwrap();
      dispatch(clearCart());
      setOrdering(false);
      onClose();
      onOrderSuccess({
        ...result,
        total: result.total ?? savedTotal,
        shopName: result.shopName || savedShopName,
      } as Order);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Something went wrong. Please try again.';
      setOrdering(false);
      onClose();
      onOrderFailure(msg);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Drag handle */}
        <View style={styles.handleBar}>
          <View style={styles.handle} />
        </View>

        {/* Active orders at top */}
        {activeOrders.slice(0, 2).map(order => {
          const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
          return (
            <View key={order.id} style={styles.activeOrderRow}>
              <View style={styles.activeIconWrap}>
                <Icon name="cube-outline" size={18} color={colors.mutedForeground} />
              </View>
              <View style={styles.activeInfo}>
                <Text style={styles.activeName} numberOfLines={1}>
                  {order.items.map(i => i.name).join(', ')}
                </Text>
                <View style={styles.activeMeta}>
                  <View style={[styles.activeBadge, { backgroundColor: sc.bg }]}>
                    <View style={[styles.activeDot, { backgroundColor: sc.color }]} />
                    <Text style={[styles.activeBadgeText, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                  <Text style={styles.activeToken}>#{order.pickupToken}</Text>
                </View>
              </View>
              <Icon name="chevron-forward" size={16} color={colors.mutedForeground} />
            </View>
          );
        })}
        {activeOrders.length > 0 && <View style={styles.sectionDivider} />}

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Your Cart</Text>
            <Text style={styles.headerSub}>{totalCount} item{totalCount !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Icon name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Cart items */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}>
          {cartItems.map(c => {
            const price = c.item.offerPrice ?? c.item.price;
            return (
              <View key={c.item.id} style={styles.itemCard}>
                {resolveImageUrl(c.item.image) ? (
                  <Image source={{ uri: resolveImageUrl(c.item.image)! }} style={styles.itemImg} />
                ) : (
                  <View style={[styles.itemImg, styles.itemImgFallback]}>
                    <Icon name="restaurant-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.itemInfo}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemName} numberOfLines={2}>{c.item.name}</Text>
                    <TouchableOpacity
                      onPress={() => dispatch(removeFromCart(c.item.id))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="trash-outline" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemCategory}>{c.item.category}</Text>
                  <View style={styles.itemBottom}>
                    <Text style={styles.itemPrice}>Rs.{price}</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => dispatch(updateQuantity({ itemId: c.item.id, quantity: c.quantity - 1 }))}>
                        <Icon name="remove" size={16} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.stepQty}>{c.quantity}</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => dispatch(updateQuantity({ itemId: c.item.id, quantity: c.quantity + 1 }))}>
                        <Icon name="add" size={16} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Footer */}
        {cartItems.length > 0 && (
          <View style={styles.footer}>
            <View style={styles.walletRow}>
              <Text style={styles.walletLabel}>Wallet Balance</Text>
              <Text style={styles.walletValue}>Rs.{balance}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>Rs.{cartTotal}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>Rs.{cartTotal}</Text>
            </View>
            {!hasBalance && (
              <Text style={styles.insufficientText}>
                Insufficient balance. Add Rs.{cartTotal - balance} to proceed.
              </Text>
            )}
            <TouchableOpacity onPress={handlePay} disabled={!hasBalance || ordering} activeOpacity={0.85}>
              <LinearGradient
                colors={hasBalance && !ordering ? ['#3b82f6', '#06d6a0'] : ['#4b5563', '#4b5563']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.payBtn}>
                {ordering ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.payBtnText}>Pay Rs.{cartTotal}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '88%',
  },
  handleBar: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },

  // Active orders
  activeOrderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, gap: 12,
  },
  activeIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },
  activeInfo: { flex: 1 },
  activeName: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
  activeMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  activeDot: { width: 5, height: 5, borderRadius: 2.5 },
  activeBadgeText: { fontSize: 11, fontWeight: '600' },
  activeToken: { fontSize: 12, color: colors.textMuted },
  sectionDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 20 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },

  // Body
  body: { maxHeight: 280 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 8 },

  // Item card
  itemCard: {
    flexDirection: 'row', gap: 14, padding: 14,
    backgroundColor: colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  itemImg: { width: 72, height: 72, borderRadius: 16 },
  itemImgFallback: { backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, marginRight: 8 },
  itemCategory: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  itemPrice: { fontSize: 16, fontWeight: '700', color: '#3b82f6' },

  // Quantity stepper
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, overflow: 'hidden',
  },
  stepBtn: { padding: 8 },
  stepQty: { fontSize: 13, fontWeight: '700', color: colors.text, width: 28, textAlign: 'center' },

  // Footer
  footer: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 10,
  },
  walletRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderRadius: 14, backgroundColor: colors.surface,
  },
  walletLabel: { fontSize: 13, color: colors.textMuted },
  walletValue: { fontSize: 15, fontWeight: '700', color: '#3b82f6' },
  divider: { height: 1, backgroundColor: colors.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: colors.textMuted },
  summaryValue: { fontSize: 14, color: colors.text },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 20, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#3b82f6' },
  insufficientText: { fontSize: 12, color: colors.danger, textAlign: 'center' },
  payBtn: { borderRadius: 18, paddingVertical: 18, alignItems: 'center' },
  payBtnText: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
});
