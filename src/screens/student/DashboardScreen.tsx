import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  Image, FlatList, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, FoodItem } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchMyActiveOrders } from '../../store/slices/ordersSlice';
import { fetchShops, fetchShopMenu, fetchShopCategories } from '../../store/slices/menuSlice';
import { addToCart, updateQuantity } from '../../store/slices/cartSlice';
import { fetchWalletBalance } from '../../store/slices/userSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import RazorpayCheckout from 'react-native-razorpay';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import walletService from '../../services/walletService';
import SearchModal from '../../components/student/SearchModal';
import TopUpModal from '../../components/student/TopUpModal';
import ProfileDropdown from '../../components/student/ProfileDropdown';

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

type PaymentMethod = 'wallet' | 'razorpay';

export default function StudentDashboard({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const { shops, menuItems: shopMenu, categories, isLoading: menuLoading } = useAppSelector(s => s.menu);
  const { activeOrders } = useAppSelector(s => s.orders);
  const { items: cartItems } = useAppSelector(s => s.cart);
  const { dietFilter } = useAppSelector(s => s.user);
  const notifications = useAppSelector(s => s.user.notifications);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const canteenShop = shops.find(s => s.category === 'canteen');

  const loadData = useCallback(async () => {
    await Promise.all([
      dispatch(fetchShops()),
      dispatch(fetchMyActiveOrders()),
    ]);
    // Load pending payments
    try {
      const payments = await walletService.getPendingPayments();
      setPendingPayments(payments || []);
    } catch { /* ignore */ }
  }, [dispatch]);

  // Load canteen menu when shop is available
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

  const handlePayNow = (payment: PendingPayment) => {
    setSelectedPayment(payment);
    const balance = user?.balance || 0;
    // Default to wallet if sufficient balance, otherwise razorpay
    setPaymentMethod(balance >= payment.amount ? 'wallet' : 'razorpay');
    setShowConfirmModal(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPayment) return;
    const balance = user?.balance || 0;

    setShowConfirmModal(false);
    setPayingId(selectedPayment.id);

    try {
      if (paymentMethod === 'wallet') {
        if (balance < selectedPayment.amount) {
          Alert.alert('Insufficient Balance', `You need Rs. ${selectedPayment.amount - balance} more. Please top up your wallet or use Razorpay.`);
          setPayingId(null);
          return;
        }
        await walletService.payAdhocPayment(selectedPayment.id);
      } else {
        // Razorpay flow
        const orderData = await walletService.createRazorpayOrder(selectedPayment.amount);
        const options = {
          key: orderData.keyId,
          amount: selectedPayment.amount * 100,
          currency: orderData.currency || 'INR',
          name: 'MadrasOne',
          description: selectedPayment.title,
          order_id: orderData.orderId,
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
            contact: (user as any)?.phone || '',
          },
          theme: { color: '#10b981' },
        };
        const paymentResponse = await RazorpayCheckout.open(options);
        await walletService.verifyRazorpayPayment({
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
        });
        // After Razorpay payment, pay the adhoc payment from the credited wallet
        await walletService.payAdhocPayment(selectedPayment.id);
      }

      // Success
      setPaymentSuccess(true);
      setPendingPayments(prev => prev.filter(p => p.id !== selectedPayment.id));
      dispatch(fetchWalletBalance());
      setTimeout(() => {
        setPaymentSuccess(false);
        setSelectedPayment(null);
      }, 2500);
    } catch (e: any) {
      if (e?.code === 'PAYMENT_CANCELLED') {
        // User dismissed Razorpay
      } else {
        Alert.alert('Payment Failed', e?.response?.data?.message || e?.description || 'Please try again.');
      }
    }
    setPayingId(null);
  };

  // Ensure categories are strings (API may return objects)
  const allCategories = useMemo(
    () => ['All', ...categories.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean)],
    [categories],
  );

  const filteredItems = useMemo(() => {
    return shopMenu.filter((item: FoodItem) => {
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesDiet = dietFilter === 'all' || (dietFilter === 'veg' && item.isVeg) || (dietFilter === 'nonveg' && !item.isVeg);
      return matchesCat && item.isAvailable && matchesDiet;
    });
  }, [shopMenu, selectedCategory, dietFilter]);

  const getCartQty = (id: string) => cartItems.find(c => c.item.id === id)?.quantity || 0;
  const totalItems = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const cartTotal = cartItems.reduce((sum, c) => sum + (c.item.offerPrice ?? c.item.price) * c.quantity, 0);

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
    ready: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Ready' },
    partially_delivered: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Partial' },
  };

  const renderFoodCard = ({ item }: { item: FoodItem }) => {
    const qty = getCartQty(item.id);
    const displayPrice = item.isOffer && item.offerPrice ? item.offerPrice : item.price;

    return (
      <View style={styles.foodCard}>
        <TouchableOpacity
          style={styles.foodImageWrap}
          onPress={() => qty === 0
            ? dispatch(addToCart({ item, shopId: canteenShop!.id, shopName: canteenShop!.name }))
            : dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 }))
          }
          activeOpacity={0.8}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.foodImage} />
          ) : (
            <View style={[styles.foodImage, styles.foodImagePlaceholder]}>
              <Icon name="restaurant-outline" size={22} color={colors.textMuted} />
            </View>
          )}
          {item.isOffer && (
            <View style={styles.offerBadge}>
              <Text style={styles.offerBadgeText}>OFFER</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.foodInfo}>
          <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.foodBottom}>
            <Text style={styles.foodPrice}>Rs.{displayPrice}</Text>
            {qty === 0 ? (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => dispatch(addToCart({ item, shopId: canteenShop!.id, shopName: canteenShop!.name }))}
                activeOpacity={0.7}>
                <Icon name="add" size={16} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.qtyControl}>
                <TouchableOpacity onPress={() => dispatch(updateQuantity({ itemId: item.id, quantity: qty - 1 }))} style={styles.qtyBtn}>
                  <Icon name="remove" size={14} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity onPress={() => dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 }))} style={styles.qtyBtn}>
                  <Icon name="add" size={14} color={colors.primary} />
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
      {/* Header Bar */}
      <View style={styles.headerBar}>
        {/* Wallet */}
        <TouchableOpacity style={styles.walletPill} activeOpacity={0.8}>
          <Icon name="wallet-outline" size={14} color={colors.primary} />
          <Text style={styles.walletPillText}>Rs. {user?.balance || 0}</Text>
        </TouchableOpacity>

        {/* Right icons */}
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}
            onPress={() => setShowSearch(true)}>
            <Icon name="search" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}
            onPress={() => {
              const stationeryShop = shops.find(s => s.category === 'stationery');
              if (stationeryShop?.isActive) navigation.navigate('Menu', { shopId: stationeryShop.id, shopName: stationeryShop.name });
            }}>
            <Icon name="document-text-outline" size={20} color="#f97316" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}
            onPress={() => setShowTopUp(true)}>
            <Icon name="add-circle-outline" size={20} color={colors.success} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}
            onPress={() => navigation.navigate('Notifications')}>
            <Icon name="notifications-outline" size={20} color={colors.textMuted} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cartIconBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Cart')}>
            <Icon name="cart-outline" size={20} color={colors.text} />
            {totalItems > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems > 9 ? '9+' : totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileIcon}
            activeOpacity={0.7}
            onPress={() => setShowProfile(true)}>
            <Text style={styles.profileInitial}>{user?.name?.[0]?.toUpperCase() || 'S'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={i => i.id}
        renderItem={renderFoodCard}
        contentContainerStyle={styles.listContent}
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
                          activeOpacity={0.8}>
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.payNowText}>Pay Now</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                      {insufficientBalance && (
                        <Text style={styles.lowBalanceText}>
                          Low balance — Razorpay available
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Active Orders */}
            {activeOrders.length > 0 && (
              <View style={styles.section}>
                {activeOrders.map(order => {
                  const sc = statusConfig[order.status] || statusConfig.pending;
                  return (
                    <TouchableOpacity
                      key={order.id}
                      style={styles.activeOrderCard}
                      onPress={() => navigation.getParent()?.navigate('Orders')}
                      activeOpacity={0.8}>
                      <View style={styles.activeOrderIcon}>
                        <Icon name="cube-outline" size={24} color="#3b82f6" />
                      </View>
                      <View style={styles.activeOrderInfo}>
                        <Text style={styles.activeOrderItems} numberOfLines={1}>
                          {order.items.map(i => i.name).join(', ')}
                        </Text>
                        <View style={styles.activeOrderMeta}>
                          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                            <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                          </View>
                          <Text style={styles.tokenText}>#{order.pickupToken}</Text>
                        </View>
                      </View>
                      <Icon name="chevron-forward" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Category Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.cats}
              contentContainerStyle={styles.catsContent}>
              {allCategories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catPill, selectedCategory === cat && styles.catPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.7}>
                  <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* All Items title */}
            <Text style={styles.allItemsTitle}>All Items</Text>

            {menuLoading && !refreshing && (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
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
        <TouchableOpacity
          style={styles.floatingBar}
          onPress={() => navigation.navigate('Cart')}
          activeOpacity={0.9}>
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
        </TouchableOpacity>
      )}

      {/* Modals */}
      <SearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
      />
      <TopUpModal
        visible={showTopUp}
        onClose={() => setShowTopUp(false)}
      />
      <ProfileDropdown
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onNavigateSettings={() => {
          setShowProfile(false);
          navigation.navigate('Profile');
        }}
      />

      {/* Payment Confirmation Modal */}
      <Modal visible={showConfirmModal} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => { setShowConfirmModal(false); setSelectedPayment(null); }}
            activeOpacity={1}
          />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm Payment</Text>

            {selectedPayment && (
              <>
                {/* Payment details */}
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

                {paymentMethod === 'wallet' && (
                  <View style={[styles.confirmRow, styles.confirmRowBorder]}>
                    <Text style={styles.confirmRowLabel}>Balance After</Text>
                    <Text style={styles.confirmRowValue}>
                      Rs. {(user?.balance || 0) - selectedPayment.amount}
                    </Text>
                  </View>
                )}

                {/* Payment Method Selection */}
                <Text style={styles.methodLabel}>Pay via</Text>
                <View style={styles.methodRow}>
                  <TouchableOpacity
                    style={[styles.methodBtn, paymentMethod === 'wallet' && styles.methodBtnActive]}
                    onPress={() => setPaymentMethod('wallet')}
                    activeOpacity={0.7}>
                    <Icon name="wallet-outline" size={20} color={paymentMethod === 'wallet' ? '#fff' : colors.primary} />
                    <Text style={[styles.methodBtnText, paymentMethod === 'wallet' && styles.methodBtnTextActive]}>
                      Wallet
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.methodBtn, paymentMethod === 'razorpay' && styles.methodBtnActive]}
                    onPress={() => setPaymentMethod('razorpay')}
                    activeOpacity={0.7}>
                    <Icon name="card-outline" size={20} color={paymentMethod === 'razorpay' ? '#fff' : colors.primary} />
                    <Text style={[styles.methodBtnText, paymentMethod === 'razorpay' && styles.methodBtnTextActive]}>
                      Razorpay
                    </Text>
                  </TouchableOpacity>
                </View>

                {paymentMethod === 'wallet' && (user?.balance || 0) < selectedPayment.amount && (
                  <View style={styles.warningBanner}>
                    <Icon name="alert-circle-outline" size={16} color="#f97316" />
                    <Text style={styles.warningText}>
                      Insufficient balance. Add Rs. {selectedPayment.amount - (user?.balance || 0)} or use Razorpay.
                    </Text>
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => { setShowConfirmModal(false); setSelectedPayment(null); }}
                    activeOpacity={0.7}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      paymentMethod === 'wallet' && (user?.balance || 0) < selectedPayment.amount && styles.confirmBtnDisabled,
                    ]}
                    onPress={handleConfirmPayment}
                    disabled={paymentMethod === 'wallet' && (user?.balance || 0) < selectedPayment.amount}
                    activeOpacity={0.8}>
                    <Text style={styles.confirmBtnText}>
                      {paymentMethod === 'razorpay' ? 'Pay with Razorpay' : 'Confirm'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  // Header
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  walletPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
  },
  walletPillText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: {
    width: 38, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 12,
  },
  cartIconBtn: {
    width: 38, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  cartBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16,
    borderRadius: 8, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  cartBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  notifBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16,
    borderRadius: 8, backgroundColor: '#ef4444',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  profileIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  profileInitial: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // List
  listContent: { padding: 16 },

  // Sections
  section: { marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },

  // Pending Payments
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

  // Payment Confirm Modal
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
  confirmRowBorder: {
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10,
  },
  confirmRowLabel: { fontSize: 14, color: colors.textMuted },
  confirmRowAmount: { fontSize: 20, fontWeight: '800', color: colors.text },
  confirmRowValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  methodLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 8, marginBottom: 8 },
  methodRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  methodBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'transparent',
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
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Success Toast
  successToast: {
    position: 'absolute', bottom: 100, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 16, backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  successToastText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  // Active Orders
  activeOrderCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 8,
    backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
  },
  activeOrderIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  activeOrderInfo: { flex: 1 },
  activeOrderItems: { fontSize: 14, fontWeight: '600', color: colors.text },
  activeOrderMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '600' },
  tokenText: { fontSize: 12, color: colors.textMuted },

  // Categories
  cats: { marginBottom: 12 },
  catsContent: { gap: 8, alignItems: 'center' },
  catPill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  catPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { fontSize: 13, fontWeight: '500', color: colors.text },
  catTextActive: { color: '#fff', fontWeight: '600' },

  // All Items
  allItemsTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },

  // Food cards
  foodCard: {
    flexDirection: 'row', gap: 10, padding: 8, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  foodImageWrap: { position: 'relative' },
  foodImage: { width: 56, height: 56, borderRadius: 10 },
  foodImagePlaceholder: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  offerBadge: { position: 'absolute', top: 2, left: 2, backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  offerBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  foodInfo: { flex: 1, justifyContent: 'space-between' },
  foodName: { fontSize: 13, fontWeight: '500', color: colors.text },
  foodBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  foodPrice: { fontSize: 12, fontWeight: '700', color: colors.primary },
  addBtn: { backgroundColor: colors.primary, borderRadius: 8, padding: 4 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 8, overflow: 'hidden' },
  qtyBtn: { padding: 4 },
  qtyText: { fontSize: 12, fontWeight: '700', color: colors.text, width: 20, textAlign: 'center' },

  // Loading / Empty
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted },

  // Floating Cart Bar
  floatingBar: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary, borderRadius: 20, padding: 14,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  floatingBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  floatingBarIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  floatingBarBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#fff', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  floatingBarBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  floatingBarSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  floatingBarTotal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  floatingBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  floatingBarAction: { fontSize: 15, fontWeight: '700', color: '#fff' },
  footerWithCart: { height: 100 },
  footerCompact: { height: 20 },
});
