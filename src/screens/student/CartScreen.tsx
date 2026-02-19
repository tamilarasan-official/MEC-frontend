import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { updateQuantity, removeFromCart, clearCart } from '../../store/slices/cartSlice';
import { createOrder } from '../../store/slices/ordersSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import { OrderAnimation } from '../../components/common/OrderAnimation';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Cart'>;

export default function CartScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { items: cartItems, shopId } = useAppSelector(s => s.cart);
  const user = useAppSelector(s => s.auth.user);
  const [orderStatus, setOrderStatus] = useState<'idle' | 'loading' | 'success' | 'failure'>('idle');
  const [pickupToken, setPickupToken] = useState('');

  const cartTotal = cartItems.reduce((sum, c) => sum + (c.item.offerPrice ?? c.item.price) * c.quantity, 0);
  const totalCount = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const balance = user?.balance || 0;
  const hasBalance = balance >= cartTotal;

  const handlePlaceOrder = async () => {
    if (!hasBalance) { setOrderStatus('failure'); return; }
    if (!shopId || cartItems.length === 0) return;

    setOrderStatus('loading');
    try {
      const result = await dispatch(createOrder({
        shopId,
        items: cartItems.map(c => ({ foodItemId: c.item.id, quantity: c.quantity })),
      })).unwrap();
      setPickupToken(result.pickupToken);
      dispatch(clearCart());
      setOrderStatus('success');
    } catch {
      setOrderStatus('failure');
    }
  };

  if (orderStatus === 'success' || orderStatus === 'failure') {
    return (
      <OrderAnimation
        type={orderStatus === 'success' ? 'success' : 'failure'}
        pickupToken={pickupToken}
        onComplete={() => {
          if (orderStatus === 'success') {
            navigation.getParent()?.navigate('Orders');
          }
          setOrderStatus('idle');
        }}
      />
    );
  }

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Your Cart</Text>
          <Text style={styles.headerSub}>{totalCount} item{totalCount !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16 }}>
        {cartItems.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="bag-handle-outline" size={48} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySub}>Add some delicious items!</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.emptyBtnText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          cartItems.map((c, _idx) => {
            const price = c.item.offerPrice ?? c.item.price;
            return (
              <View key={c.item.id} style={styles.cartCard}>
                {c.item.image ? (
                  <Image source={{ uri: c.item.image }} style={styles.cartImage} />
                ) : (
                  <View style={[styles.cartImage, styles.cartImagePlaceholder]}>
                    <Icon name="restaurant-outline" size={24} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.cartInfo}>
                  <View style={styles.cartTop}>
                    <Text style={styles.cartName} numberOfLines={1}>{c.item.name}</Text>
                    <TouchableOpacity onPress={() => dispatch(removeFromCart(c.item.id))}>
                      <Icon name="trash-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cartCategory}>{c.item.category}</Text>
                  <View style={styles.cartBottom}>
                    <Text style={styles.cartPrice}>Rs.{price * c.quantity}</Text>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => dispatch(updateQuantity({ itemId: c.item.id, quantity: c.quantity - 1 }))}>
                        <Icon name="remove" size={16} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{c.quantity}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => dispatch(updateQuantity({ itemId: c.item.id, quantity: c.quantity + 1 }))}>
                        <Icon name="add" size={16} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Footer */}
      {cartItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.walletRow}>
            <Text style={styles.walletLabel}>Wallet Balance</Text>
            <Text style={[styles.walletValue, { color: hasBalance ? colors.primary : colors.danger }]}>Rs.{balance}</Text>
          </View>
          <View style={styles.subtotalRow}>
            <Text style={styles.subLabel}>Subtotal</Text>
            <Text style={styles.subValue}>Rs.{cartTotal}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Rs.{cartTotal}</Text>
          </View>
          {!hasBalance && (
            <View style={styles.insufficientBox}>
              <Text style={styles.insufficientText}>
                Insufficient balance. Add Rs.{cartTotal - balance} to proceed.
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.payBtn, (!hasBalance || orderStatus === 'loading') && styles.payBtnDisabled]}
            onPress={handlePlaceOrder}
            disabled={!hasBalance || orderStatus === 'loading'}
            activeOpacity={0.8}>
            {orderStatus === 'loading' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payBtnText}>Pay Rs.{cartTotal}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 12, color: colors.textMuted },
  body: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySub: { fontSize: 13, color: colors.textMuted },
  emptyBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
  cartCard: {
    flexDirection: 'row', gap: 14, padding: 14, borderRadius: 18,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  cartImage: { width: 72, height: 72, borderRadius: 16 },
  cartImagePlaceholder: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  cartInfo: { flex: 1 },
  cartTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cartName: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  cartCategory: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cartBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cartPrice: { fontSize: 16, fontWeight: '700', color: colors.primary },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' },
  qtyBtn: { padding: 8 },
  qtyText: { fontSize: 13, fontWeight: '700', color: colors.text, width: 28, textAlign: 'center' },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, padding: 16, backgroundColor: colors.card, gap: 10 },
  walletRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 14, backgroundColor: colors.surface },
  walletLabel: { fontSize: 13, color: colors.textMuted },
  walletValue: { fontSize: 14, fontWeight: '600' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  subLabel: { fontSize: 13, color: colors.textMuted },
  subValue: { fontSize: 13, color: colors.text },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 18, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
  insufficientBox: { padding: 12, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  insufficientText: { fontSize: 13, color: colors.danger },
  payBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
