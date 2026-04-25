import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList,
  Image, ActivityIndicator, Dimensions, Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, FoodItem, Order } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchShopMenu, fetchShopCategories } from '../../store/slices/menuSlice';
import { addToCart, decrementQuantity, selectCartItems } from '../../store/slices/cartSlice';
import { fetchWalletBalance } from '../../store/slices/userSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { OrderQRCard } from '../../components/common/OrderQRCard';
import PINVerifyModal from '../../components/common/PINVerifyModal';
import orderService from '../../services/orderService';
import { resolveImageUrl } from '../../utils/imageUrl';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Stationery'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - CARD_GAP) / 2;

// ── Item Card (memoized) ─────────────────────────────────────────────────────

interface ItemCardProps {
  item: FoodItem;
  quantity: number;
  onAdd: (item: FoodItem) => void;
  onDecrement: (itemId: string) => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

const ItemCard = React.memo(({ item, quantity, onAdd, onDecrement, colors, styles }: ItemCardProps) => {
  const imageUri = resolveImageUrl(item.image);

  return (
    <View style={styles.card}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>₹{item.price}</Text>
          {quantity === 0 ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(item)} activeOpacity={0.8}>
              <Icon name="add" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => onDecrement(item.id)} activeOpacity={0.8}>
                <Icon name="remove" size={14} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => onAdd(item)} activeOpacity={0.8}>
                <Icon name="add" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function StationeryScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { shopId, shopName } = route.params || {};

  if (!shopId) {
    navigation.goBack();
    return null;
  }

  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);
  const { menuItems: shopMenu, categories, isLoading: menuLoading } = useAppSelector(s => s.menu);
  const user = useAppSelector(s => s.auth.user);
  const { activeOrders, orders: allOrders } = useAppSelector(s => s.orders);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const submittingRef = useRef(false);

  // Cart bar animation
  const cartBarAnim = useRef(new Animated.Value(0)).current;
  const prevItemCount = useRef(0);

  const cartShopItems = cartItems.filter(c => c.item.shopId === shopId);
  const cartCount = cartShopItems.reduce((s, c) => s + c.quantity, 0);
  const cartSubtotal = cartShopItems.reduce((s, c) => s + c.item.price * c.quantity, 0);

  useEffect(() => {
    const hasItems = cartCount > 0;
    const hadItems = prevItemCount.current > 0;
    if (hasItems && !hadItems) {
      Animated.spring(cartBarAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
    } else if (!hasItems && hadItems) {
      Animated.timing(cartBarAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
    prevItemCount.current = cartCount;
  }, [cartCount, cartBarAnim]);

  // Keep QR card in sync with Redux live order updates
  useEffect(() => {
    if (!createdOrder) return;
    const fresh = activeOrders.find(o => o.id === createdOrder.id)
      || allOrders.find(o => o.id === createdOrder.id);
    if (!fresh) return;
    if (fresh.status === 'completed' || fresh.status === 'cancelled') {
      setCreatedOrder(null);
    } else if (fresh.status !== createdOrder.status) {
      setCreatedOrder(fresh);
    }
  }, [activeOrders, allOrders, createdOrder]);

  const loadMenu = useCallback(() => {
    dispatch(fetchShopMenu({ shopId }));
    dispatch(fetchShopCategories(shopId));
  }, [dispatch, shopId]);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchShopMenu({ shopId })),
      dispatch(fetchShopCategories(shopId)),
    ]);
    setRefreshing(false);
  };

  // Build sorted category list
  const allCats = useMemo(() => {
    return categories.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean) as string[];
  }, [categories]);

  // Filter items
  const filteredItems = useMemo(() => {
    return shopMenu.filter((item: FoodItem) => {
      const matchesCat = !selectedCategory || item.category === selectedCategory;
      return matchesCat && item.isAvailable;
    });
  }, [shopMenu, selectedCategory]);

  const getQty = useCallback((id: string) => {
    return cartItems.find(c => c.item.id === id)?.quantity ?? 0;
  }, [cartItems]);

  const handleAdd = useCallback((item: FoodItem) => {
    dispatch(addToCart({ item, shopId, shopName: shopName || '' }));
  }, [dispatch, shopId, shopName]);

  const handleDecrement = useCallback((itemId: string) => {
    dispatch(decrementQuantity(itemId));
  }, [dispatch]);

  const handleCheckoutPress = () => {
    if (cartCount === 0) return;
    if (user?.isPinSetup) {
      setShowPinModal(true);
    } else {
      handlePlaceOrder();
    }
  };

  const handlePlaceOrder = async () => {
    if (submittingRef.current || cartCount === 0) return;
    submittingRef.current = true;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const items = cartShopItems.map(c => ({ foodItemId: c.item.id, quantity: c.quantity }));
      const order = await orderService.createStationeryItemOrder({ shopId, items });
      setCreatedOrder(order);
      dispatch(fetchWalletBalance());
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const renderItem = useCallback(({ item, index }: { item: FoodItem; index: number }) => (
    <View style={index % 2 === 0 ? styles.cardLeft : styles.cardRight}>
      <ItemCard
        item={item}
        quantity={getQty(item.id)}
        onAdd={handleAdd}
        onDecrement={handleDecrement}
        colors={colors}
        styles={styles}
      />
    </View>
  ), [getQty, handleAdd, handleDecrement, colors, styles]);

  const cartBarTranslate = cartBarAnim.interpolate({
    inputRange: [0, 1], outputRange: [120, 0],
  });

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{shopName || 'Stationery'}</Text>
          <View style={styles.backBtn} />
        </View>

        {/* Category pills */}
        {allCats.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
            style={styles.pillsScroll}>
            <TouchableOpacity
              style={[styles.pill, !selectedCategory && styles.pillActive]}
              onPress={() => setSelectedCategory(null)}
              activeOpacity={0.8}>
              <Text style={[styles.pillText, !selectedCategory && styles.pillTextActive]}>All</Text>
            </TouchableOpacity>
            {allCats.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.pill, selectedCategory === cat && styles.pillActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.8}>
                <Text style={[styles.pillText, selectedCategory === cat && styles.pillTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Error banner */}
        {submitError && (
          <View style={styles.errorBanner}>
            <Icon name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        )}

        {/* Items grid */}
        {menuLoading && shopMenu.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.center}>
            <Icon name="cube-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptySubtitle}>{selectedCategory ? 'Try another category' : 'Check back later'}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={[styles.listContent, cartCount > 0 && styles.listContentWithBar]}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}

        {/* Floating cart bar */}
        <Animated.View style={[styles.cartBar, { transform: [{ translateY: cartBarTranslate }] }]}>
          <View style={styles.cartBarLeft}>
            <View style={styles.cartBarBadge}>
              <Text style={styles.cartBarBadgeText}>{cartCount}</Text>
            </View>
            <Text style={styles.cartBarLabel}>items in cart</Text>
          </View>
          <Text style={styles.cartBarTotal}>₹{cartSubtotal}</Text>
          <TouchableOpacity
            style={[styles.checkoutBtn, isSubmitting && styles.checkoutBtnDisabled]}
            onPress={handleCheckoutPress}
            disabled={isSubmitting}
            activeOpacity={0.85}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.checkoutBtnText}>Place Order</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* QR card overlay */}
        {createdOrder && (
          <OrderQRCard
            order={createdOrder}
            onClose={() => setCreatedOrder(null)}
          />
        )}

        {/* T-PIN verification */}
        <PINVerifyModal
          visible={showPinModal}
          amount={cartSubtotal}
          title={cartShopItems.map(c => c.item.name).join(', ')}
          onVerified={() => { setShowPinModal(false); handlePlaceOrder(); }}
          onCancel={() => setShowPinModal(false)}
        />
      </View>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },

  // Category pills
  pillsScroll: { flexGrow: 0 },
  pillsRow: {
    flexDirection: 'row', paddingHorizontal: 16,
    paddingVertical: 10, gap: 8,
  },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.card,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  pillTextActive: { color: '#fff' },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8, padding: 12,
    backgroundColor: colors.errorBg, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  errorText: { flex: 1, fontSize: 13, color: colors.destructive },

  // Grid
  listContent: { padding: 16, paddingBottom: 20 },
  listContentWithBar: { paddingBottom: 100 },
  row: { gap: CARD_GAP, marginBottom: CARD_GAP },
  cardLeft: { width: CARD_WIDTH },
  cardRight: { width: CARD_WIDTH },

  // Item card
  card: {
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  cardImage: { width: '100%', height: CARD_WIDTH, backgroundColor: '#f0f0f0' },
  cardImagePlaceholder: { backgroundColor: '#f0f0f0' },
  cardBody: { padding: 10 },
  cardName: { fontSize: 12, fontWeight: '600', color: colors.text, minHeight: 32 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 8,
  },
  cardPrice: { fontSize: 14, fontWeight: '800', color: colors.primary },
  addBtn: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, borderRadius: 10, overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  qtyText: { fontSize: 12, fontWeight: '700', color: '#fff', minWidth: 20, textAlign: 'center' },

  // Empty / loading
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted },

  // Floating cart bar
  cartBar: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 16,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    gap: 10,
  },
  cartBarLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartBarBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  cartBarBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  cartBarLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  cartBarTotal: { fontSize: 16, fontWeight: '800', color: '#fff' },
  checkoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 12,
  },
  checkoutBtnDisabled: { opacity: 0.6 },
  checkoutBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
