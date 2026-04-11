import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  Image, FlatList, ActivityIndicator, Animated, Easing, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchMyActiveOrders, fetchMyOrders } from '../../store/slices/ordersSlice';
import { fetchShops, fetchShopMenu, fetchShopCategories } from '../../store/slices/menuSlice';
import { addToCart, updateQuantity } from '../../store/slices/cartSlice';
import { fetchWalletBalance } from '../../store/slices/userSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import SearchModal from '../../components/student/SearchModal';
import WalletModal from '../../components/student/WalletModal';
import TopUpModal from '../../components/student/TopUpModal';
import CaptainProfileDropdown from '../../components/captain/CaptainProfileDropdown';
import { CartBottomSheet } from '../../components/student/CartBottomSheet';
import NotificationsModal from '../../components/student/NotificationsModal';
import { OrderAnimation } from '../../components/common/OrderAnimation';
import { OrderQRCard } from '../../components/common/OrderQRCard';
import { useNavigation } from '@react-navigation/native';
import { FoodItem, Order, CreateOrderResult } from '../../types';
import { resolveImageUrl } from '../../utils/imageUrl';
import { mediumHaptic } from '../../utils/haptics';

const screenWidth = Dimensions.get('window').width;
const cardWidth = screenWidth - 32; // Account for parent padding (16 each side)

const CATEGORY_ICONS: Record<string, string> = {
  All: 'apps-outline',
  Classic: 'restaurant',
  Bites: 'pizza-outline',
  Snacks: 'fast-food-outline',
  Drinks: 'cafe-outline',
  Desserts: 'ice-cream-outline',
  Meals: 'restaurant-outline',
  Breakfast: 'sunny-outline',
};

function getCategoryIcon(cat: string): string {
  return CATEGORY_ICONS[cat] || 'grid-outline';
}

function FoodCardImage({ uri, style, placeholderStyle }: { uri: string | null; style: any; placeholderStyle: any }) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={[style, placeholderStyle]}>
        <Icon name="restaurant" size={24} color="#3b82f6" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      onError={() => setFailed(true)}
      accessibilityLabel="Food item image"
    />
  );
}

const CATEGORY_ORDER = ['Classic', 'Bites', 'Snacks', 'Drinks', 'Desserts', 'Meals', 'Breakfast'];

const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(234,179,8,0.15)', color: '#eab308', label: 'Ordered' },
  preparing: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Preparing' },
  ready: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Ready' },
  partially_delivered: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Partial' },
};

export default function CaptainEatScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const { shops, menuItems: shopMenu, categories, isLoading: menuLoading } = useAppSelector(s => s.menu);
  const { activeOrders, orders: allOrders } = useAppSelector(s => s.orders);
  const { items: cartItems } = useAppSelector(s => s.cart);
  const { dietFilter } = useAppSelector(s => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [splitOrders, setSplitOrders] = useState<Order[] | null>(null);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [successOrderType, setSuccessOrderType] = useState<'instant' | 'regular' | 'split'>('instant');
  const [showFailAnim, setShowFailAnim] = useState(false);
  const [failError, setFailError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Keep QR modal order in sync with Redux so real-time status updates reflect immediately
  useEffect(() => {
    if (!successOrder) return;
    const fresh = activeOrders.find(o => o.id === successOrder.id)
      || allOrders.find(o => o.id === successOrder.id);
    if (!fresh) return;
    const statusChanged = fresh.status !== successOrder.status;
    const itemsChanged = fresh.items.some((item, i) =>
      successOrder.items[i] && item.itemStatus !== successOrder.items[i].itemStatus
    );
    if (statusChanged || itemsChanged) {
      setSuccessOrder(fresh);
    }
  }, [activeOrders, allOrders, successOrder]);

  const canteenShop = shops.find(s => s.category === 'canteen');

  const loadData = useCallback(async () => {
    await Promise.all([
      dispatch(fetchShops()),
      dispatch(fetchMyActiveOrders()),
    ]);
  }, [dispatch]);

  useEffect(() => {
    if (canteenShop?.id) {
      dispatch(fetchShopMenu({ shopId: canteenShop.id }));
      dispatch(fetchShopCategories(canteenShop.id));
    }
  }, [dispatch, canteenShop?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (canteenShop?.id) {
      await dispatch(fetchShopMenu({ shopId: canteenShop.id }));
    }
    setRefreshing(false);
  };

  const allCategories = useMemo(() => {
    const cats = categories.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean) as string[];
    return [...cats].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [categories]);

  useEffect(() => {
    if (allCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(allCategories[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategories]);

  const filteredItems = useMemo(() => {
    return shopMenu.filter((item: FoodItem) => {
      const matchesCat = !selectedCategory || item.category === selectedCategory;
      const matchesDiet = dietFilter === 'all' || (dietFilter === 'veg' && item.isVeg) || (dietFilter === 'nonveg' && !item.isVeg);
      return matchesCat && item.isAvailable && matchesDiet;
    });
  }, [shopMenu, selectedCategory, dietFilter]);

  const getCartQty = (id: string) => cartItems.find(c => c.item.id === id)?.quantity || 0;
  const totalItems = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const cartTotal = cartItems.reduce((sum, c) => sum + (c.item.offerPrice ?? c.item.price) * c.quantity, 0);

  const renderFoodCard = ({ item }: { item: FoodItem }) => {
    const qty = getCartQty(item.id);
    const displayPrice = item.isOffer && item.offerPrice ? item.offerPrice : item.price;
    const imageUri = resolveImageUrl(item.image);

    return (
      <View style={styles.foodCard}>
        <TouchableOpacity
          style={styles.foodImageWrap}
          onPress={() => qty === 0
            ? dispatch(addToCart({ item, shopId: canteenShop?.id ?? '', shopName: canteenShop?.name ?? '' }))
            : dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 }))
          }
          activeOpacity={0.8}
          accessibilityLabel={`Add ${item.name}`}
          accessibilityRole="button">
          <FoodCardImage
            uri={imageUri}
            style={styles.foodImage}
            placeholderStyle={styles.foodImagePlaceholder}
          />
          {item.isOffer && (
            <View style={styles.offerBadge}>
              <Text style={styles.offerBadgeText}>OFFER</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.foodInfo}>
          <View style={styles.foodNameRow}>
            <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
            {item.isInstant && (
              <Icon name="flash-sharp" size={13} color="#f97316" />
            )}
          </View>
          <View style={styles.foodBottom}>
            <Text style={styles.foodPrice}>Rs.{displayPrice}</Text>
            {qty === 0 ? (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => dispatch(addToCart({ item, shopId: canteenShop?.id ?? '', shopName: canteenShop?.name ?? '' }))}
                activeOpacity={0.7}
                accessibilityLabel={`Add ${item.name} to cart`}
                accessibilityRole="button">
                <Icon name="add" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.qtyControl}>
                <TouchableOpacity onPress={() => dispatch(updateQuantity({ itemId: item.id, quantity: qty - 1 }))} style={styles.qtyBtn} accessibilityLabel={`Decrease ${item.name} quantity`} accessibilityRole="button">
                  <Icon name="remove" size={14} color="#3b82f6" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity onPress={() => dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 }))} style={styles.qtyBtn} accessibilityLabel={`Increase ${item.name} quantity`} accessibilityRole="button">
                  <Icon name="add" size={14} color="#3b82f6" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.walletPill}
            onPress={() => setShowWallet(true)}
            activeOpacity={0.8}
            accessibilityLabel="Open wallet"
            accessibilityRole="button">
            <Icon name="wallet-outline" size={13} color="#3b82f6" />
            <Text style={styles.walletPillText}>Rs. {user?.balance || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topUpBtn}
            onPress={() => setShowTopUp(true)}
            activeOpacity={0.7}
            accessibilityLabel="Top up wallet"
            accessibilityRole="button">
            <Icon name="add" size={16} color="#22c55e" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7} onPress={() => setShowSearch(true)} accessibilityLabel="Search menu" accessibilityRole="button">
            <Icon name="search" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7} onPress={() => setShowCart(true)} accessibilityLabel="Open cart" accessibilityRole="button">
            <Icon name="cart-outline" size={20} color={colors.textMuted} />
            {totalItems > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileIcon}
            activeOpacity={0.7}
            onPress={() => setShowProfile(true)}
            accessibilityLabel="Open profile"
            accessibilityRole="button">
            {resolveImageUrl(user?.avatarUrl) ? (
              <Image source={{ uri: resolveImageUrl(user?.avatarUrl)! }} style={styles.profileAvatarImg} accessibilityLabel="Profile avatar" />
            ) : (
              <Text style={styles.profileInitial}>{user?.name?.[0]?.toUpperCase() || 'C'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={i => i.id}
        renderItem={renderFoodCard}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <>
            {/* Active Orders — Swipeable Carousel */}
            {activeOrders.length > 0 && (
              <View style={styles.section}>
                <FlatList
                  data={activeOrders}
                  keyExtractor={o => o.id}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={cardWidth + 8}
                  decelerationRate="fast"
                  onScroll={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 8));
                    setCarouselIndex(idx);
                  }}
                  scrollEventThrottle={16}
                  renderItem={({ item: order }) => {
                    const sc = statusConfig[order.status] || statusConfig.pending;
                    return (
                      <TouchableOpacity
                        style={[styles.carouselCard, { width: cardWidth }]}
                        onPress={() => { mediumHaptic(); setSelectedOrder(order); }}
                        activeOpacity={0.85}
                        accessibilityLabel="Show order QR"
                        accessibilityRole="button">
                        <View style={styles.carouselRow}>
                          <OrderPulseIcon color={sc.color} />
                          <View style={styles.carouselInfo}>
                            <Text style={styles.carouselItems} numberOfLines={1}>
                              {order.items.map(i => i.name).join(', ')}
                            </Text>
                            <View style={styles.carouselMeta}>
                              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                                <View style={[styles.statusDot, { backgroundColor: sc.color }]} />
                                <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                              </View>
                              <Text style={styles.tokenText}>#{order.pickupToken}</Text>
                            </View>
                          </View>
                          <Icon name="chevron-forward" size={20} color={colors.textMuted} />
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
                {activeOrders.length > 1 && (
                  <View style={styles.dotsRow}>
                    {activeOrders.map((_, i) => (
                      <View key={i} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Category Pills */}
            <View style={styles.cats}>
              <View style={styles.catsContent}>
                {allCategories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catPill, selectedCategory === cat && styles.catPillActive]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Category ${cat}`}
                    accessibilityRole="button">
                    <Icon
                      name={getCategoryIcon(cat)}
                      size={14}
                      color={selectedCategory === cat ? '#fff' : colors.textMuted}
                    />
                    <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {menuLoading && !refreshing && (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !menuLoading ? (
            <View style={styles.empty}>
              <Icon name="search" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySubtitle}>No items available in this category</Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={totalItems > 0 ? styles.footerWithCart : styles.footerCompact} />}
      />

      {/* Floating Cart Bar */}
      {totalItems > 0 && (
        <View style={styles.floatingBarWrap} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => { mediumHaptic(); setShowCart(true); }}
            activeOpacity={0.9}
            accessibilityLabel="View cart"
            accessibilityRole="button">
            <View style={styles.floatingBar}>
              <LinearGradient
                colors={['#3b82f6', '#06d6a0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.floatingBarLeft}>
                <View style={styles.floatingBarIcon}>
                  <Icon name="bag-handle" size={22} color="#fff" />
                  <View style={styles.floatingBarBadge}>
                    <Text style={styles.floatingBarBadgeText}>{totalItems}</Text>
                  </View>
                </View>
                <View>
                  <Text style={styles.floatingBarSub}>{totalItems} item{totalItems > 1 ? 's' : ''}</Text>
                  <Text style={styles.floatingBarTotal}>Rs. {cartTotal}</Text>
                </View>
              </View>
              <View style={styles.floatingBarRight}>
                <Text style={styles.floatingBarAction}>View Cart</Text>
                <Icon name="arrow-forward" size={18} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Modals */}
      <SearchModal visible={showSearch} onClose={() => setShowSearch(false)} />
      <WalletModal
        visible={showWallet}
        onClose={() => setShowWallet(false)}
        onTopUp={() => setShowTopUp(true)}
        onTransactionPress={() => navigation.navigate('Wallet' as any)}
      />
      <TopUpModal visible={showTopUp} onClose={() => setShowTopUp(false)} />
      <CaptainProfileDropdown
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onNavigateNotifications={() => setShowNotifications(true)}
      />
      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {/* Cart Bottom Sheet */}
      <CartBottomSheet
        visible={showCart}
        onClose={() => setShowCart(false)}
        onOrderSuccess={(result: CreateOrderResult) => {
          dispatch(fetchMyActiveOrders());

          if (result.wasSplit && result.orders && result.orders.length > 1) {
            setSplitOrders(result.orders);
            setSuccessOrder(result.order);
            setSuccessOrderType('split');
            setShowSuccessAnim(true);
          } else {
            const order = result.order;
            setSplitOrders(null);
            setSuccessOrder(order);
            setSuccessOrderType(order.isReadyServe ? 'instant' : 'regular');
            setShowSuccessAnim(true);
          }
          setTimeout(() => setShowCart(false), 150);
        }}
        onOrderFailure={(errorMessage) => {
          setFailError(errorMessage || '');
          setShowFailAnim(true);
          setTimeout(() => setShowCart(false), 150);
        }}
      />

      {/* Order Success Animation */}
      {showSuccessAnim && successOrder && (
        <OrderAnimation
          type="success"
          orderType={successOrderType}
          pickupToken={successOrder.pickupToken}
          orderId={successOrder.id}
          total={splitOrders
            ? splitOrders.reduce((sum, o) => sum + o.total, 0)
            : successOrder.total}
          splitOrders={splitOrders || undefined}
          onComplete={() => setShowSuccessAnim(false)}
        />
      )}

      {/* Order Failure Animation */}
      {showFailAnim && (
        <OrderAnimation
          type="failure"
          errorMessage={failError}
          onComplete={() => { setShowFailAnim(false); setFailError(''); }}
        />
      )}

      {/* Order QR Card */}
      {successOrder && !showSuccessAnim && (
        <OrderQRCard
          order={successOrder}
          onClose={() => {
            if (splitOrders && splitOrders.length > 1) {
              const nextOrder = splitOrders.find(o => o.id !== successOrder.id);
              if (nextOrder) {
                setSuccessOrder(nextOrder);
                setSplitOrders(null);
                return;
              }
            }
            setSuccessOrder(null);
            setSplitOrders(null);
            dispatch(fetchMyActiveOrders());
            dispatch(fetchWalletBalance());
          }}
        />
      )}

      {/* QR Card from carousel tap */}
      {selectedOrder && (
        <OrderQRCard order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </ScreenWrapper>
  );
}

function OrderPulseIcon({ color }: { color: string }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.8, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.6, duration: 0, useNativeDriver: true }),
      ]),
    ])).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 48, height: 48, borderRadius: 24,
        borderWidth: 2, borderStyle: 'dashed', borderColor: color,
        transform: [{ scale: pulseAnim }], opacity: opacityAnim,
      }} />
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        borderWidth: 1.5, borderColor: color + '40', borderStyle: 'dotted',
        justifyContent: 'center', alignItems: 'center',
      }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  // Header
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topUpBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  walletPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder,
  },
  walletPillText: { fontSize: 13, fontWeight: '700', color: '#3b82f6' },
  headerIconBtn: {
    width: 38, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 12,
  },
  profileIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  profileAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  profileInitial: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cartBadge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // List
  listContent: { padding: 16, paddingTop: 12 },

  // Section
  section: { marginBottom: 16 },

  // Active Orders — Carousel
  carouselCard: {
    padding: 16, borderRadius: 18, marginRight: 8,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  carouselRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  carouselInfo: { flex: 1 },
  carouselItems: { fontSize: 14, fontWeight: '600', color: colors.text },
  carouselMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.accent, borderRadius: 3 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  tokenText: { fontSize: 12, color: colors.textMuted },

  // Category Pills
  cats: { marginBottom: 14 },
  catsContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 24,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
  },
  catPillActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  catText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  catTextActive: { color: '#fff' },

  // Food Cards
  foodCard: {
    flexDirection: 'row', gap: 12, padding: 10, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  foodImageWrap: { position: 'relative' },
  foodImage: { width: 68, height: 68, borderRadius: 12 },
  foodImagePlaceholder: {
    backgroundColor: 'rgba(59,130,246,0.25)', justifyContent: 'center', alignItems: 'center',
  },
  offerBadge: {
    position: 'absolute', top: 3, left: 3, backgroundColor: colors.primary,
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  offerBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  foodInfo: { flex: 1, justifyContent: 'space-between', paddingVertical: 2 },
  foodNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  foodName: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1 },
  foodBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  foodPrice: { fontSize: 13, fontWeight: '700', color: '#3b82f6' },
  addBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center',
  },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 12, overflow: 'hidden',
  },
  qtyBtn: { padding: 5 },
  qtyText: { fontSize: 13, fontWeight: '700', color: colors.text, width: 22, textAlign: 'center' },

  // Loading / Empty
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted },

  // Floating Cart Bar
  floatingBarWrap: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    borderRadius: 20,
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  floatingBar: {
    height: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 20, paddingHorizontal: 16, overflow: 'hidden',
  },
  floatingBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  floatingBarIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  floatingBarBadge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: '#fff',
    borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center',
  },
  floatingBarBadgeText: { fontSize: 10, fontWeight: '800', color: '#3b82f6' },
  floatingBarSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  floatingBarTotal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  floatingBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  floatingBarAction: { fontSize: 15, fontWeight: '700', color: '#fff' },
  footerWithCart: { height: 100 },
  footerCompact: { height: 20 },
});
