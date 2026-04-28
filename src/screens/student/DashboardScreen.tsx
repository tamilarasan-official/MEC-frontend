import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl, Dimensions, Easing,
  Image, FlatList, ScrollView, ActivityIndicator, Modal, Alert, Animated, LayoutAnimation, Platform, AppState, PanResponder,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StudentHomeStackParamList, FoodItem, Order, CreateOrderResult } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchMyActiveOrders, createOrder } from '../../store/slices/ordersSlice';
import { fetchShops, fetchShopMenu, fetchShopCategories, fetchStationeryMenu } from '../../store/slices/menuSlice';
import { addToCart, updateQuantity } from '../../store/slices/cartSlice';
import { fetchWalletBalance } from '../../store/slices/userSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import walletService from '../../services/walletService';
import SearchModal from '../../components/student/SearchModal';
import WalletModal from '../../components/student/WalletModal';
import NotificationsModal from '../../components/student/NotificationsModal';
import TopUpModal from '../../components/student/TopUpModal';
import ProfileDropdown from '../../components/student/ProfileDropdown';
import { CartBottomSheet } from '../../components/student/CartBottomSheet';
import PINVerifyModal from '../../components/common/PINVerifyModal';
import { OrderAnimation } from '../../components/common/OrderAnimation';
import { OrderQRCard } from '../../components/common/OrderQRCard';
import { lightHaptic, mediumHaptic, successHaptic } from '../../utils/haptics';
import { resolveImageUrl } from '../../utils/imageUrl';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Dashboard'>;

interface PendingPayment {
  id: string;
  title: string;
  description?: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'cancelled';
  requestCreatedAt?: string;
}

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

const FoodCardImage = React.memo(({ uri, style, placeholderStyle }: { uri: string | null; style: any; placeholderStyle: any }) => {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);

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
      onError={onError}
      accessibilityLabel="Food item image"
    />
  );
});

// ── Swipeable wrapper for quick 1-tap order ──────────────────────────────────
const SwipeableQuickOrderCard = React.memo(function SwipeableQuickOrderCard({
  item,
  onSwipeOrder,
  children,
}: {
  item: FoodItem;
  onSwipeOrder: (item: FoodItem) => void;
  children: React.ReactNode;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const canSwipeRef = useRef(item.isAvailable !== false);
  canSwipeRef.current = item.isAvailable !== false;
  const onSwipeRef = useRef(onSwipeOrder);
  onSwipeRef.current = onSwipeOrder;
  const itemRef = useRef(item);
  itemRef.current = item;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        canSwipeRef.current && g.dx > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dx <= 0) return;
        translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        const triggered = g.dx > 80 || (g.dx > 20 && g.vx > 0.3);
        if (triggered) {
          Animated.timing(translateX, {
            toValue: Dimensions.get('window').width,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            mediumHaptic();
            onSwipeRef.current(itemRef.current);
            setTimeout(() => translateX.setValue(0), 300);
          });
        } else {
          Animated.spring(translateX, { toValue: 0, friction: 8, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <View style={quickSwipeStyles.outer}>
      {item.isAvailable !== false && (
        <Animated.View style={[quickSwipeStyles.stripOuter, {
          opacity: translateX.interpolate({ inputRange: [0, 40], outputRange: [0, 1], extrapolate: 'clamp' }),
        }]}>
          <LinearGradient
            colors={['#00f7ff', '#00a3ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Icon name="bag-handle-outline" size={22} color="#fff" />
          <Text style={quickSwipeStyles.stripLabel}>Order</Text>
        </Animated.View>
      )}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...(item.isAvailable !== false ? panResponder.panHandlers : {})}
      >
        {children}
      </Animated.View>
    </View>
  );
});

const quickSwipeStyles = StyleSheet.create({
  outer: { overflow: 'hidden', borderRadius: 16, marginBottom: 10 },
  stripOuter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  stripLabel: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 3 },
});

export default function StudentDashboard({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const { shops, menuItems: shopMenu, categories, isLoading: menuLoading, stationeryItems, stationeryCategories, stationeryLoading } = useAppSelector(s => s.menu);
  const { activeOrders, orders: allOrders } = useAppSelector(s => s.orders);
  const { items: cartItems } = useAppSelector(s => s.cart);
  const { dietFilter } = useAppSelector(s => s.user);
  const notifications = useAppSelector(s => s.user.notifications);
  const [refreshing, setRefreshing] = useState(false);
  const [shopMode, setShopMode] = useState<'classic' | 'bites' | 'stationery'>('classic');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStationeryCategory, setSelectedStationeryCategory] = useState<string | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [splitOrders, setSplitOrders] = useState<Order[] | null>(null);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [successOrderType, setSuccessOrderType] = useState<'instant' | 'regular' | 'split'>('instant');
  const [showFailAnim, setShowFailAnim] = useState(false);
  const [failError, setFailError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [showPaymentPIN, setShowPaymentPIN] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const submittingRef = useRef(false);
  const paymentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [quickOrderItem, setQuickOrderItem] = useState<FoodItem | null>(null);
  const [showQuickPIN, setShowQuickPIN] = useState(false);
  const quickOrderingRef = useRef(false);
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);
  const [insufficientMsg, setInsufficientMsg] = useState('');
  const screenWidth = Dimensions.get('window').width - 32; // 16px padding each side

  // Keep QR modal order in sync with Redux so real-time status updates reflect immediately.
  // Check both activeOrders and allOrders — completed/cancelled orders get removed from
  // activeOrders on refetch, but patchOrderStatus updates them in-place before that happens.
  // Also detect item-level changes (itemStatus) so per-item tags update in the QR modal.
  useEffect(() => {
    if (!successOrder) return;
    const fresh = activeOrders.find(o => o.id === successOrder.id)
      || allOrders.find(o => o.id === successOrder.id);
    if (!fresh) return;
    // Detect status change OR any item-level status change
    const statusChanged = fresh.status !== successOrder.status;
    const itemsChanged = fresh.items.some((item, i) =>
      successOrder.items[i] && item.itemStatus !== successOrder.items[i].itemStatus
    );
    if (statusChanged || itemsChanged) {
      // Auto-dismiss QR card when order is completed or cancelled
      if (fresh.status === 'completed' || fresh.status === 'cancelled') {
        setSuccessOrder(null);
        setSplitOrders(null);
      } else {
        setSuccessOrder(fresh);
      }
    }
  }, [activeOrders, allOrders, successOrder]);

  // Same sync for selectedOrder (carousel QR tap)
  useEffect(() => {
    if (!selectedOrder) return;
    const fresh = activeOrders.find(o => o.id === selectedOrder.id)
      || allOrders.find(o => o.id === selectedOrder.id);
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
  }, [activeOrders, allOrders, selectedOrder]);

  useEffect(() => {
    return () => {
      if (paymentTimerRef.current !== null) clearTimeout(paymentTimerRef.current);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const canteenShop = shops.find(s => s.category === 'canteen');
  const stationeryShop = shops.find(s => s.category === 'stationery');
  const isShopOpen = canteenShop?.isActive !== false; // closed if explicitly false
  const isStudent = user?.role === 'student';

  const loadData = useCallback(async () => {
    const promises: Promise<any>[] = [dispatch(fetchShops())];
    // Only students can access /orders/my — skip for captain/owner in eat mode
    if (isStudent) {
      promises.push(dispatch(fetchMyActiveOrders()));
    }
    await Promise.all(promises);
    if (isStudent) {
      try {
        const payments = await walletService.getPendingPayments();
        setPendingPayments(payments || []);
      } catch { /* ignore */ }
    }
  }, [dispatch, isStudent]);

  useEffect(() => {
    if (canteenShop?.id && isShopOpen) {
      dispatch(fetchShopMenu({ shopId: canteenShop.id }));
      dispatch(fetchShopCategories(canteenShop.id));
    }
  }, [dispatch, canteenShop?.id, isShopOpen]);

  // Re-fetch canteen menu when this screen regains focus (e.g. returning from Profile, Orders, etc.)
  useFocusEffect(useCallback(() => {
    if (canteenShop?.id) {
      dispatch(fetchShopMenu({ shopId: canteenShop.id }));
      dispatch(fetchShopCategories(canteenShop.id));
    }
  }, [dispatch, canteenShop?.id]));

  useEffect(() => { loadData(); }, [loadData]);

  // Refetch active orders when app returns to foreground — socket handles live updates (#70)
  useEffect(() => {
    if (!isStudent) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') dispatch(fetchMyActiveOrders());
    });
    return () => sub.remove();
  }, [dispatch, isStudent]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (shopMode === 'stationery' && stationeryShop?.id) {
      await dispatch(fetchStationeryMenu(stationeryShop.id));
    } else if (canteenShop?.id) {
      await dispatch(fetchShopMenu({ shopId: canteenShop.id }));
    }
    setRefreshing(false);
  };

  const handlePayNow = (payment: PendingPayment) => {
    setSelectedPayment(payment);
    setShowConfirmModal(true);
  };

  const executeAdhocPayment = useCallback(async () => {
    if (submittingRef.current || !selectedPayment) return;
    submittingRef.current = true;
    setPayingId(selectedPayment.id);
    const payment = selectedPayment;
    try {
      await walletService.payAdhocPayment(payment.id);
      successHaptic();
      setPaymentSuccess(true);
      setPendingPayments(prev => prev.filter(p => p.id !== payment.id));
      dispatch(fetchWalletBalance());
      dispatch(fetchMyActiveOrders());
      paymentTimerRef.current = setTimeout(() => {
        setPaymentSuccess(false);
        setSelectedPayment(null);
      }, 2500);
    } catch (e: any) {
      Alert.alert('Payment Failed', e?.response?.data?.message || 'Please try again.');
    } finally {
      submittingRef.current = false;
      setPayingId(null);
    }
  }, [selectedPayment, dispatch]);

  const handleConfirmPayment = () => {
    if (!selectedPayment) return;
    const balance = user?.balance || 0;
    setShowConfirmModal(false);
    if (balance < selectedPayment.amount) {
      setInsufficientMsg(`You need Rs. ${selectedPayment.amount - balance} more. Please top up your wallet.`);
      setShowInsufficientBalance(true);
      return;
    }
    if (user?.isPinSetup) {
      setShowPaymentPIN(true);
    } else {
      executeAdhocPayment();
    }
  };

  const CATEGORY_ORDER = ['Classic', 'Bites', 'Snacks', 'Drinks', 'Desserts', 'Meals', 'Breakfast'];

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // Auto-select the first category once categories load (runs only when list changes)
  useEffect(() => {
    if (allCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(allCategories[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategories]);

  const filteredItems = useMemo(() => {
    if (shopMode === 'stationery') {
      return stationeryItems.filter(i =>
        i.isAvailable && (!selectedStationeryCategory || i.category === selectedStationeryCategory),
      );
    }
    if (!canteenShop || !isShopOpen) return [];
    const modeCategory = shopMode === 'classic' ? 'Classic' : 'Bites';
    return shopMenu.filter((item: FoodItem) => {
      const matchesMode = item.category === modeCategory;
      const matchesDiet = dietFilter === 'all' || (dietFilter === 'veg' && item.isVeg) || (dietFilter === 'nonveg' && !item.isVeg);
      return matchesMode && item.isAvailable && matchesDiet;
    });
  }, [shopMenu, shopMode, dietFilter, canteenShop, isShopOpen, stationeryItems, selectedStationeryCategory]);

  const handleModeTab = useCallback((mode: 'classic' | 'bites' | 'stationery') => {
    setShopMode(mode);
    setSelectedStationeryCategory(null);
    if (mode === 'stationery' && stationeryShop && stationeryItems.length === 0 && !stationeryLoading) {
      dispatch(fetchStationeryMenu(stationeryShop.id));
    }
  }, [stationeryShop, stationeryItems.length, stationeryLoading, dispatch]);

  const keyExtractor = useCallback((i: FoodItem) => i.id, []);
  const getCartQty = useCallback((id: string) => cartItems.find(c => c.item.id === id)?.quantity || 0, [cartItems]);
  const totalItems = useMemo(() => cartItems.reduce((sum, c) => sum + c.quantity, 0), [cartItems]);
  const cartTotal = useMemo(() => cartItems.reduce((sum, c) => sum + (c.item.offerPrice ?? c.item.price) * c.quantity, 0), [cartItems]);

  // Animated floating cart bar
  const cartBarAnim = useRef(new Animated.Value(0)).current;
  const prevTotalItems = useRef(0);
  useEffect(() => {
    const hasItems = totalItems > 0;
    const hadItems = prevTotalItems.current > 0;
    if (hasItems && !hadItems) {
      Animated.spring(cartBarAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
    } else if (!hasItems && hadItems) {
      Animated.timing(cartBarAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
    prevTotalItems.current = totalItems;
  }, [totalItems, cartBarAnim]);

  // ── Quick swipe-to-order handlers ───────────────────────────────────────────

  const handleQuickOrderPlace = useCallback(async (item: FoodItem) => {
    if (!canteenShop || quickOrderingRef.current) return;
    quickOrderingRef.current = true;
    try {
      const result: CreateOrderResult = await dispatch(createOrder({
        shopId: canteenShop.id,
        items: [{ foodItemId: item.id, quantity: 1 }],
      })).unwrap();
      dispatch(fetchMyActiveOrders());
      dispatch(fetchWalletBalance());
      const order = result.order;
      setSplitOrders(null);
      setSuccessOrder(order);
      setSuccessOrderType(order.isReadyServe ? 'instant' : 'regular');
      setShowSuccessAnim(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        (err?.message && err.message !== 'Rejected' ? err.message : null) ||
        'Order failed. Please check your balance and try again.';
      setFailError(msg);
      setShowFailAnim(true);
    } finally {
      quickOrderingRef.current = false;
      setQuickOrderItem(null);
    }
  }, [canteenShop, dispatch]);

  const handleSwipeOrder = useCallback((item: FoodItem) => {
    if (quickOrderingRef.current) return;
    if (!canteenShop || !isShopOpen) {
      Alert.alert('Shop Closed', 'The canteen is currently closed.');
      return;
    }
    if (!item.isAvailable) return;
    const price = item.isOffer && item.offerPrice ? item.offerPrice : item.price;
    if ((user?.balance ?? 0) < price) {
      setInsufficientMsg(`You need Rs.${price} to order ${item.name}. Top up your wallet to continue.`);
      setShowInsufficientBalance(true);
      return;
    }
    setQuickOrderItem(item);
    if (user?.isPinSetup) {
      setShowQuickPIN(true);
    } else {
      handleQuickOrderPlace(item);
    }
  }, [canteenShop, isShopOpen, user?.balance, user?.isPinSetup, handleQuickOrderPlace]);

  // ── End quick swipe handlers ─────────────────────────────────────────────────

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { text: 'Overdue', isUrgent: true };
    if (diffDays === 0) return { text: 'Due today', isUrgent: true };
    if (diffDays === 1) return { text: 'Due tomorrow', isUrgent: true };
    if (diffDays <= 7) return { text: `Due in ${diffDays} days`, isUrgent: false };
    return { text: `Due ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, isUrgent: false };
  };

  const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(234,179,8,0.15)', color: '#eab308', label: 'Ordered' },
    preparing: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Preparing' },
    partially_ready: { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6', label: 'Partially Ready' },
    ready: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Ready' },
    partially_delivered: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Partial' },
  };

  const renderStationeryCard = ({ item }: { item: FoodItem }) => {
    const qty = getCartQty(item.id);
    const imageUri = resolveImageUrl(item.image);
    return (
      <View style={styles.statCard}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.statCardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.statCardImage, styles.statCardImagePlaceholder]}>
            <Icon name="cube-outline" size={28} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.statCardBody}>
          <Text style={styles.statCardName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.statCardFooter}>
            <Text style={styles.statCardPrice}>₹{item.price}</Text>
            {qty === 0 ? (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => {
                  if (!stationeryShop) return;
                  lightHaptic();
                  dispatch(addToCart({ item, shopId: stationeryShop.id, shopName: stationeryShop.name }));
                }}
                activeOpacity={0.7}
                accessibilityLabel={`Add ${item.name} to cart`}
                accessibilityRole="button">
                <Icon name="add" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.qtyControl}>
                <TouchableOpacity
                  onPress={() => { lightHaptic(); dispatch(updateQuantity({ itemId: item.id, quantity: qty - 1 })); }}
                  style={styles.qtyBtn}
                  accessibilityLabel={`Decrease ${item.name} quantity`}
                  accessibilityRole="button">
                  <Icon name="remove" size={14} color="#3b82f6" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity
                  onPress={() => { lightHaptic(); dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 })); }}
                  style={styles.qtyBtn}
                  accessibilityLabel={`Increase ${item.name} quantity`}
                  accessibilityRole="button">
                  <Icon name="add" size={14} color="#3b82f6" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderFoodCard = ({ item }: { item: FoodItem }) => {
    const qty = getCartQty(item.id);
    const displayPrice = item.isOffer && item.offerPrice ? item.offerPrice : item.price;
    const imageUri = resolveImageUrl(item.image);

    return (
      <SwipeableQuickOrderCard item={item} onSwipeOrder={handleSwipeOrder}>
        <View style={[styles.foodCard, { marginBottom: 0 }]}>
          {/* Food image / placeholder */}
          <TouchableOpacity
            style={styles.foodImageWrap}
            onPress={() => { if (!canteenShop) return; lightHaptic(); qty === 0
              ? dispatch(addToCart({ item, shopId: canteenShop.id, shopName: canteenShop.name }))
              : dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 }));
            }}
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

          {/* Food info */}
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
                  onPress={() => { if (!canteenShop) return; lightHaptic(); dispatch(addToCart({ item, shopId: canteenShop.id, shopName: canteenShop.name })); }}
                  activeOpacity={0.7}
                  accessibilityLabel={`Add ${item.name} to cart`}
                  accessibilityRole="button">
                  <Icon name="add" size={18} color="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={styles.qtyControl}>
                  <TouchableOpacity onPress={() => { lightHaptic(); dispatch(updateQuantity({ itemId: item.id, quantity: qty - 1 })); }} style={styles.qtyBtn} accessibilityLabel={`Decrease ${item.name} quantity`} accessibilityRole="button">
                    <Icon name="remove" size={14} color="#3b82f6" />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{qty}</Text>
                  <TouchableOpacity onPress={() => { lightHaptic(); dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 })); }} style={styles.qtyBtn} accessibilityLabel={`Increase ${item.name} quantity`} accessibilityRole="button">
                    <Icon name="add" size={14} color="#3b82f6" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </SwipeableQuickOrderCard>
    );
  };

  return (
    <ScreenWrapper>
      {/* ── Header Bar ── */}
      <View style={styles.headerBar}>
        {/* Left: Logo + Wallet */}
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/icons/appicon.png')}
            style={styles.logoBox}
            resizeMode="contain"
            accessibilityLabel="CampusOne logo"
          />
          <TouchableOpacity
            style={styles.walletPill}
            onPress={() => setShowWallet(true)}
            activeOpacity={0.8}
            accessibilityLabel="Open wallet"
            accessibilityRole="button">
            <Icon name="wallet-outline" size={13} color="#3b82f6" />
            <Text style={styles.walletPillText}>Rs. {user?.balance || 0}</Text>
          </TouchableOpacity>
        </View>

        {/* Right: Search + Profile */}
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7} onPress={() => setShowSearch(true)} accessibilityLabel="Search" accessibilityRole="button">
            <Icon name="search" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileIcon}
            activeOpacity={0.7}
            onPress={() => setShowProfile(true)}
            accessibilityLabel="Open profile"
            accessibilityRole="button">
            {unreadCount > 0 && <View style={styles.profileBadge} />}
            {resolveImageUrl(user?.avatarUrl) ? (
              <Image source={{ uri: resolveImageUrl(user?.avatarUrl) ?? undefined }} style={styles.profileAvatarImg} accessibilityLabel="Profile avatar" />
            ) : (
              <Text style={styles.profileInitial}>{user?.name?.[0]?.toUpperCase() || 'S'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Mode Tab Bar: Classic | Bites | Stationery ── */}
      <View style={styles.modeBar}>
        <TouchableOpacity
          style={[styles.modeTab, shopMode === 'classic' && styles.modeTabActive]}
          onPress={() => handleModeTab('classic')}
          activeOpacity={0.8}>
          <Icon name="restaurant" size={14} color={shopMode === 'classic' ? '#fff' : colors.textMuted} />
          <Text style={[styles.modeTabText, shopMode === 'classic' && styles.modeTabTextActive]}>Classic</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, shopMode === 'bites' && styles.modeTabActive]}
          onPress={() => handleModeTab('bites')}
          activeOpacity={0.8}>
          <Icon name="pizza-outline" size={14} color={shopMode === 'bites' ? '#fff' : colors.textMuted} />
          <Text style={[styles.modeTabText, shopMode === 'bites' && styles.modeTabTextActive]}>Bites</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, shopMode === 'stationery' && styles.modeTabActive]}
          onPress={() => handleModeTab('stationery')}
          activeOpacity={0.8}>
          <Icon name="storefront-outline" size={14} color={shopMode === 'stationery' ? '#fff' : colors.textMuted} />
          <Text style={[styles.modeTabText, shopMode === 'stationery' && styles.modeTabTextActive]}>Stationery</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        key={shopMode === 'stationery' ? 'stationery-grid' : 'canteen-list'}
        data={filteredItems}
        keyExtractor={keyExtractor}
        renderItem={shopMode === 'stationery' ? renderStationeryCard : renderFoodCard}
        numColumns={shopMode === 'stationery' ? 2 : 1}
        columnWrapperStyle={shopMode === 'stationery' ? styles.statRow : undefined}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            {/* Pending Payments */}
            {pendingPayments.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Icon name="card-outline" size={16} color="#f97316" />
                  <Text style={styles.sectionTitle}>Pending Payments</Text>
                </View>
                {pendingPayments.map(payment => {
                  const dueInfo = formatDueDate(payment.dueDate);
                  const isProcessing = payingId === payment.id;
                  const insufficientBalance = (user?.balance || 0) < payment.amount;
                  return (
                    <View key={payment.id} style={styles.paymentCard}>
                      <View style={styles.paymentTop}>
                        <View style={styles.paymentInfo}>
                          <Text style={styles.paymentTitle} numberOfLines={1}>{payment.title}</Text>
                          {payment.description && (
                            <Text style={styles.paymentDesc} numberOfLines={2}>{payment.description}</Text>
                          )}
                        </View>
                        <Text style={styles.paymentAmount}>Rs. {payment.amount}</Text>
                      </View>
                      <View style={styles.paymentBottom}>
                        <View style={styles.dueDateRow}>
                          <Icon name="calendar-outline" size={14} color={colors.textMuted} />
                          <Text style={[styles.dueDateText, dueInfo.isUrgent && styles.dueDateUrgent]}>
                            {dueInfo.text}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.payNowBtn}
                          onPress={() => handlePayNow(payment)}
                          disabled={isProcessing}
                          activeOpacity={0.8}
                          accessibilityLabel="Pay now"
                          accessibilityRole="button">
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.payNowText}>Pay Now</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                      {insufficientBalance && (
                        <Text style={styles.lowBalanceText}>Insufficient balance — top up your wallet</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Active Orders — Swipeable Carousel */}
            {activeOrders.length > 0 && (
              <View style={styles.section}>
                <FlatList
                  data={activeOrders}
                  keyExtractor={o => o.id}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={screenWidth + 8}
                  decelerationRate="fast"
                  onScroll={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / (screenWidth + 8));
                    setCarouselIndex(idx);
                  }}
                  scrollEventThrottle={16}
                  renderItem={({ item: order }) => {
                    const sc = statusConfig[order.status] || statusConfig.pending;
                    return (
                      <TouchableOpacity
                        style={[styles.carouselCard, { width: screenWidth }]}
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
                {/* Dot indicators */}
                {activeOrders.length > 1 && (
                  <View style={styles.dotsRow}>
                    {activeOrders.map((_, i) => (
                      <View key={i} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Shop Closed Banner — only shown for canteen modes */}
            {shopMode !== 'stationery' && (!canteenShop || !isShopOpen) && !menuLoading && (
              <View style={styles.shopClosedBanner}>
                <View style={styles.shopClosedIcon}>
                  <Icon name="storefront-outline" size={28} color="#ef4444" />
                </View>
                <Text style={styles.shopClosedTitle}>Shop is Closed</Text>
                <Text style={styles.shopClosedSubtitle}>
                  The canteen is currently closed. Please check back later.
                </Text>
              </View>
            )}

            {/* Stationery category pills */}
            {shopMode === 'stationery' && stationeryCategories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.statPillsScroll}
                contentContainerStyle={styles.statPillsRow}>
                {[null, ...stationeryCategories].map(cat => {
                  const active = cat === selectedStationeryCategory;
                  return (
                    <TouchableOpacity
                      key={cat ?? 'all'}
                      style={[styles.statPill, active && styles.statPillActive]}
                      onPress={() => setSelectedStationeryCategory(cat)}
                      activeOpacity={0.8}>
                      <Text style={[styles.statPillText, active && styles.statPillTextActive]} numberOfLines={1}>
                        {cat ?? 'All'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Loading indicators */}
            {shopMode === 'stationery' && stationeryLoading && (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            )}
            {shopMode !== 'stationery' && menuLoading && !refreshing && (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          shopMode === 'stationery' && !stationeryLoading ? (
            <View style={styles.empty}>
              <Icon name="cube-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySubtitle}>{selectedStationeryCategory ? 'Try another category' : 'Check back later'}</Text>
            </View>
          ) : !menuLoading && isShopOpen && canteenShop && shopMode !== 'stationery' ? (
            <View style={styles.empty}>
              <Icon name="search" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySubtitle}>No items available in this category</Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={totalItems > 0 ? styles.footerWithCart : styles.footerCompact} />}
      />

      {/* Floating Cart Bar — animated slide up/down */}
      <Animated.View style={[styles.floatingBarWrap, {
        transform: [{ translateY: cartBarAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }],
        opacity: cartBarAnim,
        pointerEvents: totalItems > 0 ? 'auto' : 'none',
      }]}>
        <TouchableOpacity
          onPress={() => { mediumHaptic(); setShowCart(true); }}
          activeOpacity={0.9}
          accessibilityLabel="View cart"
          accessibilityRole="button">
          <LinearGradient
            colors={isShopOpen ? ['#3b82f6', '#06d6a0'] : ['#6b7280', '#6b7280']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.floatingBar}>
            <View style={styles.floatingBarLeft}>
              <View style={styles.floatingBarIcon}>
                <Icon name={isShopOpen ? 'bag-handle' : 'storefront-outline'} size={22} color="#fff" />
                <View style={styles.floatingBarBadge}>
                  <Text style={styles.floatingBarBadgeText}>{totalItems}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.floatingBarSub}>{isShopOpen ? `${totalItems} item${totalItems > 1 ? 's' : ''}` : 'Shop Closed'}</Text>
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

      {/* Modals */}
      <SearchModal visible={showSearch} onClose={() => setShowSearch(false)} />
      <WalletModal
        visible={showWallet}
        onClose={() => setShowWallet(false)}
        onTopUp={() => setShowTopUp(true)}
        onTransactionPress={(tx) => {
          setShowWallet(false);
          navigation.navigate('TransactionDetail', { transactionId: tx.id });
        }}
      />
      <TopUpModal visible={showTopUp} onClose={() => setShowTopUp(false)} />
      <NotificationsModal visible={showNotifications} onClose={() => setShowNotifications(false)} />
      <ProfileDropdown
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onNavigateSettings={() => {
          setShowProfile(false);
          navigation.navigate('Profile');
        }}
        onNavigateCart={() => { setShowProfile(false); setShowCart(true); }}
        onNavigateNotifications={() => { setShowProfile(false); setShowNotifications(true); }}
        onAddBalance={() => setShowTopUp(true)}
      />

      {/* Cart Bottom Sheet */}
      <CartBottomSheet
        visible={showCart}
        onClose={() => setShowCart(false)}
        onOrderSuccess={(result: CreateOrderResult) => {
          dispatch(fetchMyActiveOrders());

          // Show success animation FIRST, then hide cart after a short delay
          // to prevent white flicker between cart closing and animation appearing
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
          // Delay cart close so OrderAnimation's fade-in covers the transition
          setTimeout(() => setShowCart(false), 150);
        }}
        onOrderFailure={(errorMessage) => {
          setFailError(errorMessage || '');
          setShowFailAnim(true);
          setTimeout(() => setShowCart(false), 150);
        }}
      />

      {/* Quick swipe-to-order PIN modal */}
      <PINVerifyModal
        visible={showQuickPIN}
        amount={quickOrderItem
          ? (quickOrderItem.isOffer && quickOrderItem.offerPrice ? quickOrderItem.offerPrice : quickOrderItem.price)
          : 0}
        title={quickOrderItem?.name ?? ''}
        onVerified={() => {
          setShowQuickPIN(false);
          if (quickOrderItem) handleQuickOrderPlace(quickOrderItem);
        }}
        onCancel={() => {
          setShowQuickPIN(false);
          setQuickOrderItem(null);
        }}
      />

      {/* Adhoc payment PIN modal */}
      <PINVerifyModal
        visible={showPaymentPIN}
        amount={selectedPayment?.amount ?? 0}
        title={selectedPayment?.title ?? ''}
        onVerified={() => {
          setShowPaymentPIN(false);
          executeAdhocPayment();
        }}
        onCancel={() => {
          setShowPaymentPIN(false);
          setSelectedPayment(null);
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
          onComplete={() => {
            setShowSuccessAnim(false);
          }}
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

      {/* Order QR Card — shown after success anim closes */}
      {successOrder && !showSuccessAnim && (
        <OrderQRCard
          order={successOrder}
          onClose={() => {
            // If split orders, show QR for the other order
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

      {/* Payment Confirmation Modal */}
      <Modal visible={showConfirmModal} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => { setShowConfirmModal(false); setSelectedPayment(null); }}
            activeOpacity={1}
            accessibilityLabel="Close modal"
            accessibilityRole="button"
          />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm Payment</Text>

            {selectedPayment && (
              <>
                <View style={styles.confirmDetailBox}>
                  <Text style={styles.confirmDetailLabel}>Payment for</Text>
                  <Text style={styles.confirmDetailValue}>{selectedPayment.title}</Text>
                </View>

                <View style={styles.confirmRow}>
                  <Text style={styles.confirmRowLabel}>Amount</Text>
                  <Text style={styles.confirmRowAmount}>Rs. {selectedPayment.amount}</Text>
                </View>

                <View style={styles.confirmRow}>
                  <Text style={styles.confirmRowLabel}>Your Balance</Text>
                  <Text style={[styles.confirmRowValue, { color: colors.primary }]}>Rs. {user?.balance || 0}</Text>
                </View>

                <View style={[styles.confirmRow, styles.confirmRowBorder]}>
                  <Text style={styles.confirmRowLabel}>Balance After</Text>
                  <Text style={[
                    styles.confirmRowValue,
                    (user?.balance || 0) < selectedPayment.amount && { color: '#ef4444' },
                  ]}>
                    Rs. {(user?.balance || 0) - selectedPayment.amount}
                  </Text>
                </View>

                {(user?.balance || 0) < selectedPayment.amount && (
                  <View style={styles.warningBanner}>
                    <Icon name="alert-circle-outline" size={16} color="#f97316" />
                    <Text style={styles.warningText}>
                      Insufficient balance. Top up Rs. {selectedPayment.amount - (user?.balance || 0)} to pay.
                    </Text>
                  </View>
                )}

                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => { setShowConfirmModal(false); setSelectedPayment(null); }}
                    activeOpacity={0.7}
                    accessibilityLabel="Cancel payment"
                    accessibilityRole="button">
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      (user?.balance || 0) < selectedPayment.amount && styles.confirmBtnDisabled,
                    ]}
                    onPress={handleConfirmPayment}
                    disabled={(user?.balance || 0) < selectedPayment.amount}
                    activeOpacity={0.8}
                    accessibilityLabel="Confirm payment"
                    accessibilityRole="button">
                    <Icon name="wallet-outline" size={16} color="#fff" />
                    <Text style={styles.confirmBtnText}>Pay Rs. {selectedPayment.amount}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Insufficient Balance Modal */}
      <Modal visible={showInsufficientBalance} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.insufficientCard}>
            <View style={styles.insufficientIconWrap}>
              <Icon name="wallet-outline" size={28} color="#ef4444" />
            </View>
            <Text style={styles.insufficientTitle}>Insufficient Balance</Text>
            <Text style={styles.insufficientMsg}>{insufficientMsg}</Text>
            <View style={styles.insufficientActions}>
              <TouchableOpacity
                style={styles.insufficientDismiss}
                onPress={() => setShowInsufficientBalance(false)}
                activeOpacity={0.7}>
                <Text style={styles.insufficientDismissText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.insufficientTopUp}
                onPress={() => { setShowInsufficientBalance(false); setShowTopUp(true); }}
                activeOpacity={0.8}>
                <Icon name="add-circle-outline" size={16} color="#fff" />
                <Text style={styles.insufficientTopUpText}>Top Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Success Toast */}
      {paymentSuccess && (
        <View style={styles.successToast}>
          <Icon name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.successToastText}>Payment successful!</Text>
        </View>
      )}
    </ScreenWrapper>
  );
}

/* ─── Pulsing Ring Icon for Carousel ─── */
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
  // ── Mode Tab Bar ──
  modeBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, gap: 8,
  },
  modeTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.card,
    alignSelf: 'flex-start',
  },
  modeTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeTabText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  modeTabTextActive: { color: '#fff' },

  // ── Header ──
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: {
    width: 34, height: 34, borderRadius: 10,
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
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  profileAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  profileBadge: {
    position: 'absolute', top: 0, right: 0, width: 10, height: 10,
    borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: colors.background,
    zIndex: 1,
  },
  profileInitial: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── List content ──
  listContent: { padding: 16, paddingTop: 12 },

  // ── Section ──
  section: { marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },

  // ── Pending Payments ──
  paymentCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  paymentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  paymentInfo: { flex: 1, marginRight: 12 },
  paymentTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  paymentDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  paymentAmount: { fontSize: 18, fontWeight: '800', color: colors.text },
  paymentBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dueDateText: { fontSize: 13, color: colors.textMuted },
  dueDateUrgent: { color: '#f97316', fontWeight: '600' },
  payNowBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.primary, minWidth: 80, alignItems: 'center',
  },
  payNowText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  lowBalanceText: { fontSize: 11, color: '#f97316', marginTop: 8 },

  // ── Active Orders ──
  // Carousel card
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

  // ── Category Pills ──
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

  // ── Food Cards ──
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

  // ── Shop Closed Banner ──
  shopClosedBanner: {
    alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 16,
    borderRadius: 20, backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  shopClosedIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(239,68,68,0.12)',
    justifyContent: 'center' as const, alignItems: 'center' as const, marginBottom: 4,
  },
  shopClosedTitle: { fontSize: 18, fontWeight: '700', color: '#ef4444' },
  shopClosedSubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center' as const },

  // ── Loading / Empty ──
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted },

  // ── Stationery inline grid ──
  statPillsScroll: { marginBottom: 12 },
  statPillsRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  statPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  statPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statPillText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  statPillTextActive: { color: '#fff' },
  statRow: { gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  statCardImage: { width: '100%', aspectRatio: 1.4, backgroundColor: colors.surface },
  statCardImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  statCardBody: { padding: 8 },
  statCardName: { fontSize: 11, fontWeight: '600', color: colors.text, minHeight: 28 },
  statCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  statCardPrice: { fontSize: 13, fontWeight: '800', color: colors.primary },

  // ── Floating Cart Bar ──
  floatingBarWrap: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    borderRadius: 20,
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  floatingBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 20, padding: 14,
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
  floatingBarBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  floatingBarSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  floatingBarTotal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  floatingBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  floatingBarAction: { fontSize: 15, fontWeight: '700', color: '#fff' },
  footerWithCart: { height: 100 },
  footerCompact: { height: 20 },

  // ── Payment Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  confirmCard: {
    width: '100%', maxWidth: 360, backgroundColor: colors.background,
    borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  confirmDetailBox: {
    padding: 14, borderRadius: 14, backgroundColor: colors.surface, marginBottom: 16,
  },
  confirmDetailLabel: { fontSize: 12, color: colors.textMuted },
  confirmDetailValue: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
  confirmRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  confirmRowBorder: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  confirmRowLabel: { fontSize: 14, color: colors.textMuted },
  confirmRowAmount: { fontSize: 20, fontWeight: '800', color: colors.text },
  confirmRowValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  methodLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 8, marginBottom: 8 },
  methodRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  methodBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'transparent',
  },
  methodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  methodBtnTextActive: { color: '#fff' },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', marginBottom: 16,
  },
  warningText: { fontSize: 12, color: '#f97316', flex: 1 },
  confirmActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.surface, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
  confirmBtn: {
    flex: 1, flexDirection: 'row', paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── Insufficient Balance Modal ──
  insufficientCard: {
    width: '100%', maxWidth: 340, backgroundColor: colors.background,
    borderRadius: 24, padding: 28, alignItems: 'center',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12,
  },
  insufficientIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  insufficientTitle: {
    fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 10, textAlign: 'center',
  },
  insufficientMsg: {
    fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  insufficientActions: { flexDirection: 'row', gap: 12, width: '100%' },
  insufficientDismiss: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    backgroundColor: colors.surface, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  insufficientDismissText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  insufficientTopUp: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primary,
  },
  insufficientTopUpText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Success Toast ──
  successToast: {
    position: 'absolute', bottom: 100, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 16, backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  successToastText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
