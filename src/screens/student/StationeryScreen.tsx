import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList,
  Image, ActivityIndicator, Dimensions, Animated, TextInput, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, FoodItem, Order, CreateOrderResult } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchShopMenu, fetchShopCategories } from '../../store/slices/menuSlice';
import { addToCart, decrementQuantity, selectCartItems } from '../../store/slices/cartSlice';
import { fetchWalletBalance } from '../../store/slices/userSlice';
import { fetchMyActiveOrders } from '../../store/slices/ordersSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { OrderQRCard } from '../../components/common/OrderQRCard';
import { OrderAnimation } from '../../components/common/OrderAnimation';
import { CartBottomSheet } from '../../components/student/CartBottomSheet';
import StationeryRequestsModal from '../../components/student/StationeryRequestsModal';
import { resolveImageUrl } from '../../utils/imageUrl';
import { mediumHaptic } from '../../utils/haptics';
import stationeryRequestService from '../../services/stationeryRequestService';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Stationery'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 10;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - CARD_GAP) / 2;
const CARD_IMG_HEIGHT = Math.round(CARD_WIDTH * 0.72);

// ── Item Card (memoized) ─────────────────────────────────────────────────────

interface ItemCardProps {
  item: FoodItem;
  quantity: number;
  onAdd: (item: FoodItem) => void;
  onDecrement: (itemId: string) => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

const ItemCard = React.memo(({ item, quantity, onAdd, onDecrement, colors: _colors, styles }: ItemCardProps) => {
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
  const activeShopId = shopId || '';

  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);
  const { menuItems: rawMenuItems, categories, isLoading: menuLoading } = useAppSelector(s => s.menu);
  const shopMenu = useMemo(() => rawMenuItems.filter((i: FoodItem) => i.shopId === activeShopId), [rawMenuItems, activeShopId]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [requestText, setRequestText] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [showSubmittedRequests, setShowSubmittedRequests] = useState(false);

  // Cart sheet + success/failure flow (same as DashboardScreen)
  const [showCart, setShowCart] = useState(false);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [showFailAnim, setShowFailAnim] = useState(false);
  const [failError, setFailError] = useState('');

  // Cart bar animation
  const cartBarAnim = useRef(new Animated.Value(0)).current;
  const prevItemCount = useRef(0);

  const cartShopItems = cartItems.filter(c => c.item.shopId === activeShopId);
  const cartCount = cartShopItems.reduce((s, c) => s + c.quantity, 0);
  const cartTotal = cartShopItems.reduce((s, c) => s + c.item.price * c.quantity, 0);

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

  const loadMenu = useCallback(async () => {
    if (!activeShopId) {
      setInitialLoading(false);
      return;
    }
    setInitialLoading(true);
    await Promise.all([
      dispatch(fetchShopMenu({ shopId: activeShopId })),
      dispatch(fetchShopCategories(activeShopId)),
    ]);
    setInitialLoading(false);
  }, [dispatch, activeShopId]);

  useEffect(() => { loadMenu(); }, [loadMenu]);
  useEffect(() => {
    if (!activeShopId) {
      navigation.goBack();
    }
  }, [activeShopId, navigation]);

  const onRefresh = async () => {
    if (!activeShopId) return;
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchShopMenu({ shopId: activeShopId })),
      dispatch(fetchShopCategories(activeShopId)),
    ]);
    setRefreshing(false);
  };

  const allCats = useMemo(() => {
    return categories.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean) as string[];
  }, [categories]);

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
    if (!activeShopId) return;
    dispatch(addToCart({ item, shopId: activeShopId, shopName: shopName || '' }));
  }, [dispatch, activeShopId, shopName]);

  const handleDecrement = useCallback((itemId: string) => {
    dispatch(decrementQuantity(itemId));
  }, [dispatch]);

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

  if (!activeShopId) {
    return null;
  }

  const cartBarTranslate = cartBarAnim.interpolate({
    inputRange: [0, 1], outputRange: [100, 0],
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
        <View style={styles.pillsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillsScroll}
            contentContainerStyle={styles.pillsRow}>
            {['All', ...allCats].map(cat => {
              const isAll = cat === 'All';
              const active = isAll ? !selectedCategory : selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setSelectedCategory(isAll ? null : cat)}
                  activeOpacity={0.8}>
                  <Text
                    style={[styles.pillText, active && styles.pillTextActive]}
                    numberOfLines={1}
                    allowFontScaling={false}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.requestCard}>
          <View style={styles.requestHeader}>
            <Icon name="chatbox-ellipses-outline" size={18} color={colors.primary} />
            <Text style={styles.requestTitle}>Request for owner</Text>
          </View>
          <Text style={styles.requestHint}>Add item details, brand, size, or any special request.</Text>
          <TextInput
            style={styles.requestInput}
            value={requestText}
            onChangeText={setRequestText}
            placeholder="Example: Need 2 blue gel pens and 1 long notebook"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.requestCount}>{requestText.trim().length}/500</Text>
          {requestText.trim().length > 0 && (
            <TouchableOpacity
              style={styles.requestSubmitBtn}
              onPress={async () => {
                if (submittingRequest) return;
                setSubmittingRequest(true);
                try {
                  await stationeryRequestService.create(activeShopId, requestText);
                  setRequestText('');
                  Alert.alert('Request sent', 'Your stationery request was sent to the owner for the next 24 hours.');
                } catch (error: any) {
                  Alert.alert('Request failed', error?.response?.data?.error?.message || error?.message || 'Could not submit stationery request');
                } finally {
                  setSubmittingRequest(false);
                }
              }}
              activeOpacity={0.85}
              disabled={submittingRequest}
            >
              <Text style={styles.requestSubmitBtnText}>{submittingRequest ? 'Submitting...' : 'Submit Request'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.requestViewBtn}
            onPress={() => setShowSubmittedRequests(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.requestViewBtnText}>View Submitted Requests</Text>
          </TouchableOpacity>
        </View>

        {/* Items grid */}
        {(initialLoading || menuLoading) && shopMenu.length === 0 ? (
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

        {/* Floating cart bar — same style as DashboardScreen */}
        <Animated.View style={[styles.floatingBarWrap, {
          transform: [{ translateY: cartBarTranslate }],
          opacity: cartBarAnim,
          pointerEvents: cartCount > 0 ? 'auto' : 'none',
        }]}>
          <TouchableOpacity
            onPress={() => { mediumHaptic(); setShowCart(true); }}
            activeOpacity={0.9}>
            <LinearGradient
              colors={['#3b82f6', '#06d6a0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.floatingBar}>
              <View style={styles.floatingBarLeft}>
                <View style={styles.floatingBarIconWrap}>
                  <Icon name="bag-handle" size={22} color="#fff" />
                  <View style={styles.floatingBarBadge}>
                    <Text style={styles.floatingBarBadgeText}>{cartCount}</Text>
                  </View>
                </View>
                <View>
                  <Text style={styles.floatingBarSub}>{cartCount} item{cartCount > 1 ? 's' : ''}</Text>
                  <Text style={styles.floatingBarTotal}>Rs. {cartTotal}</Text>
                </View>
              </View>
              <View style={styles.floatingBarRight}>
                <Text style={styles.floatingBarAction}>View Cart</Text>
                <Icon name="arrow-forward" size={18} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Cart bottom sheet */}
        <CartBottomSheet
          visible={showCart}
          onClose={() => setShowCart(false)}
          orderNotes={requestText}
          onOrderSuccess={(result: CreateOrderResult) => {
            dispatch(fetchMyActiveOrders());
            dispatch(fetchWalletBalance());
            setSuccessOrder(result.order);
            setShowSuccessAnim(true);
            setRequestText('');
            setTimeout(() => setShowCart(false), 150);
          }}
          onOrderFailure={(errorMessage) => {
            setFailError(errorMessage || '');
            setShowFailAnim(true);
            setTimeout(() => setShowCart(false), 150);
          }}
        />

        {/* Success animation */}
        {showSuccessAnim && successOrder && (
          <OrderAnimation
            type="success"
            orderType="instant"
            pickupToken={successOrder.pickupToken}
            orderId={successOrder.id}
            total={successOrder.total}
            onComplete={() => setShowSuccessAnim(false)}
          />
        )}

        {/* Failure animation */}
        {showFailAnim && (
          <OrderAnimation
            type="failure"
            errorMessage={failError}
            onComplete={() => { setShowFailAnim(false); setFailError(''); }}
          />
        )}

        {/* QR card after animation */}
        {successOrder && !showSuccessAnim && (
          <OrderQRCard
            order={successOrder}
            onClose={() => {
              setSuccessOrder(null);
              dispatch(fetchMyActiveOrders());
              dispatch(fetchWalletBalance());
            }}
          />
        )}
        <StationeryRequestsModal visible={showSubmittedRequests} onClose={() => setShowSubmittedRequests(false)} />
      </View>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },

  pillsContainer: { height: 52 },
  pillsScroll: { flex: 1 },
  pillsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  pill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.card,
    marginRight: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.textMuted, includeFontPadding: false },
  pillTextActive: { color: '#fff' },

  requestCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  requestTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  requestHint: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  requestInput: {
    minHeight: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
  },
  requestCount: {
    marginTop: 8,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
  },
  requestSubmitBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  requestSubmitBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  requestViewBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestViewBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },

  listContent: { padding: 16, paddingBottom: 20 },
  listContentWithBar: { paddingBottom: 100 },
  row: { gap: CARD_GAP, marginBottom: CARD_GAP },
  cardLeft: { width: CARD_WIDTH },
  cardRight: { width: CARD_WIDTH },

  card: {
    backgroundColor: colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  cardImage: { width: '100%', height: CARD_IMG_HEIGHT, backgroundColor: '#f0f0f0' },
  cardImagePlaceholder: { backgroundColor: '#f0f0f0' },
  cardBody: { padding: 8 },
  cardName: { fontSize: 11, fontWeight: '600', color: colors.text, minHeight: 28 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 6,
  },
  cardPrice: { fontSize: 13, fontWeight: '800', color: colors.primary },
  addBtn: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, borderRadius: 10, overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  qtyText: { fontSize: 12, fontWeight: '700', color: '#fff', minWidth: 20, textAlign: 'center' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted },

  // Floating cart bar (matches DashboardScreen style)
  floatingBarWrap: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
  },
  floatingBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20,
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
  floatingBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  floatingBarIconWrap: { position: 'relative' },
  floatingBarBadge: {
    position: 'absolute', top: -6, right: -8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  floatingBarBadgeText: { fontSize: 10, fontWeight: '800', color: '#3b82f6' },
  floatingBarSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  floatingBarTotal: { fontSize: 16, fontWeight: '800', color: '#fff' },
  floatingBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  floatingBarAction: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
