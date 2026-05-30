import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, TextInput, AppState,
  Animated, PanResponder, Dimensions, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../../store';
import {
  fetchShopDetails, fetchQRPayments, fetchWalletBalance, fetchDashboardStats,
} from '../../store/slices/userSlice';
import {
  fetchActiveShopOrders, updateOrderStatus, completeOrder, acceptAllItems, rejectAllItems,
} from '../../store/slices/ordersSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import OwnerProfileDropdown from '../../components/owner/OwnerProfileDropdown';
import OwnerWalletModal from '../../components/owner/OwnerWalletModal';
import CreateQRPaymentModal from '../../components/owner/CreateQRPaymentModal';
import QRPaymentDisplayModal from '../../components/owner/QRPaymentDisplayModal';
import { QRPayment, Order, StationeryRequestGroup } from '../../types';
import { resolveAvatarUrl } from '../../utils/imageUrl';
import { mediumHaptic } from '../../utils/haptics';
import NotificationsModal from '../../components/student/NotificationsModal';
import stationeryRequestService from '../../services/stationeryRequestService';

// ============================================================
// ORDER DASHBOARD — Swipeable card (order-level only)
// ============================================================

const SWIPE_THRESHOLD = 80;

interface SwipeAction { label: string; icon: string; color: string; onAction: () => void }

function getSwipeCfg(
  order: Order,
  onAccept: (id: string) => void,
  onReject: (id: string) => void,
  onReady: (id: string) => void,
  onComplete: (id: string) => void,
): { right: SwipeAction | null; left: SwipeAction | null } {
  if (order.status === 'pending') return {
    right: { label: 'Accept', icon: 'checkmark-done', color: '#22c55e', onAction: () => onAccept(order.id) },
    left:  { label: 'Reject', icon: 'close',          color: '#ef4444', onAction: () => onReject(order.id) },
  };
  if (order.status === 'preparing' || order.status === 'partially_ready') return {
    right: { label: 'Ready', icon: 'checkmark-circle', color: '#0ea5e9', onAction: () => onReady(order.id) },
    left: null,
  };
  if (order.status === 'ready' || order.status === 'partially_delivered') return {
    right: { label: 'Complete', icon: 'checkmark', color: '#22c55e', onAction: () => onComplete(order.id) },
    left: null,
  };
  return { right: null, left: null };
}

const SwipeableOrderCard = React.memo(function SwipeableOrderCard({ order, swipeRight, swipeLeft, colors, styles, isUpdating }: {
  order: Order;
  swipeRight: SwipeAction | null;
  swipeLeft: SwipeAction | null;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  isUpdating: boolean;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeRightRef = useRef(swipeRight);
  const swipeLeftRef  = useRef(swipeLeft);
  swipeRightRef.current = swipeRight;
  swipeLeftRef.current  = swipeLeft;
  const hasSwipe = !!(swipeRight || swipeLeft);
  const hasSwipeRef = useRef(hasSwipe);
  hasSwipeRef.current = hasSwipe;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      hasSwipeRef.current && Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => {
      if (g.dx > 0 && !swipeRightRef.current) return;
      if (g.dx < 0 && !swipeLeftRef.current) return;
      translateX.setValue(g.dx);
    },
    onPanResponderRelease: (_, g) => {
      const rightTrig = swipeRightRef.current && (g.dx > SWIPE_THRESHOLD || (g.dx > 20 && g.vx > 0.3));
      const leftTrig  = swipeLeftRef.current  && (g.dx < -SWIPE_THRESHOLD || (g.dx < -20 && g.vx < -0.3));
      if (rightTrig) {
        Animated.timing(translateX, { toValue: Dimensions.get('window').width, duration: 200, useNativeDriver: true }).start(() => {
          mediumHaptic();
          swipeRightRef.current?.onAction();
          setTimeout(() => translateX.setValue(0), 300);
        });
      } else if (leftTrig) {
        Animated.timing(translateX, { toValue: -Dimensions.get('window').width, duration: 200, useNativeDriver: true }).start(() => {
          mediumHaptic();
          swipeLeftRef.current?.onAction();
          setTimeout(() => translateX.setValue(0), 300);
        });
      } else {
        Animated.spring(translateX, { toValue: 0, friction: 8, useNativeDriver: true }).start();
      }
    },
  })).current;

  const timeStr = new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const hintParts: string[] = [];
  if (swipeLeft)  hintParts.push(`← ${swipeLeft.label}`);
  if (swipeRight) hintParts.push(`${swipeRight.label} →`);

  return (
    <View style={styles.swipeContainer}>
      {swipeRight && (
        <Animated.View style={[styles.swipeBg, { backgroundColor: swipeRight.color, opacity: translateX.interpolate({ inputRange: [0, 30], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
          <View style={styles.swipeBgLeft}>
            <Icon name={swipeRight.icon} size={22} color="#fff" />
            <Text style={styles.swipeBgText}>{swipeRight.label}</Text>
          </View>
        </Animated.View>
      )}
      {swipeLeft && (
        <Animated.View style={[styles.swipeBg, { backgroundColor: swipeLeft.color, opacity: translateX.interpolate({ inputRange: [-30, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
          <View style={styles.swipeBgRight}>
            <Text style={styles.swipeBgText}>{swipeLeft.label}</Text>
            <Icon name={swipeLeft.icon} size={22} color="#fff" />
          </View>
        </Animated.View>
      )}
      <Animated.View style={[styles.orderCard, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        {isUpdating && (
          <View style={styles.updatingOverlay}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}
        {/* Card header */}
        <View style={styles.cardHeader}>
          <Text style={styles.orderToken}>#{order.pickupToken}</Text>
          <Text style={styles.orderTime}>{timeStr}</Text>
          <Text style={styles.orderCustomer} numberOfLines={1}>{order.userName || '—'}</Text>
          <Text style={styles.orderTotal}>₹{order.total}</Text>
        </View>
        {/* Items */}
        <View style={styles.itemsList}>
          {order.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.quantity}×</Text>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
        </View>
        {order.notes ? (
          <View style={styles.orderNoteBox}>
            <Text style={styles.orderNoteLabel}>Request</Text>
            <Text style={styles.orderNoteText}>{order.notes}</Text>
          </View>
        ) : null}
        {hintParts.length > 0 && (
          <Text style={styles.swipeHint}>{hintParts.join('  |  ')}</Text>
        )}
      </Animated.View>
    </View>
  );
});

// ============================================================
// QR PAYMENT CARD (unchanged from original)
// ============================================================

function StatItem({ value, label, color, labelColor }: { value: string | number; label: string; color: string; labelColor?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: '500', color: labelColor || '#6b7280', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function QRPaymentCard({ payment, colors, styles, onPress }: { payment: QRPayment; colors: ThemeColors; styles: ReturnType<typeof createStyles>; onPress: () => void }) {
  const isPaid = payment.paidCount > 0;
  return (
    <TouchableOpacity style={styles.qrCard} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.qrCardBadges}>
        <View style={styles.qrTypeBadge}>
          <Icon name="qr-code-outline" size={10} color="#06b6d4" />
          <Text style={styles.qrTypeBadgeText}>QR PAYMENT</Text>
        </View>
        {isPaid && (
          <View style={styles.statusBadgePaid}>
            <Icon name="checkmark-circle-outline" size={10} color="#22c55e" />
            <Text style={styles.paidBadgeText}>Paid</Text>
          </View>
        )}
      </View>
      <Text style={styles.qrCardTitle}>{payment.title}</Text>
      <Text style={styles.qrCardAmount}>
        Rs. {payment.amount}{isPaid ? ` · Collected: Rs. ${payment.totalCollected}` : ''}
      </Text>
      {payment.payers && payment.payers.length > 0 && (
        <View style={styles.payerSection}>
          {payment.payers.slice(0, 3).map((payer, idx) => (
            <View key={idx} style={styles.payerRow}>
              <View style={styles.payerLeft}>
                <Icon name="person-outline" size={14} color={colors.mutedForeground} />
                <Text style={styles.payerName} numberOfLines={1}>
                  {payer.studentName}{payer.studentRollNumber ? ` (${payer.studentRollNumber})` : ''}
                </Text>
              </View>
              <Text style={styles.payerDate}>
                {new Date(payer.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })},{' '}
                {new Date(payer.paidAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}
              </Text>
            </View>
          ))}
          {payment.payers.length > 3 && (
            <Text style={styles.morePayersText}>+{payment.payers.length - 3} more</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================

export default function StationeryHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();

  const user         = useAppSelector(s => s.auth.user);
  const shopDetails  = useAppSelector(s => s.user.shopDetails);
  const qrPayments   = useAppSelector(s => s.user.qrPayments);
  const qrPaymentsLoading = useAppSelector(s => s.user.qrPaymentsLoading);
  const shopOrders   = useAppSelector(s => s.orders.shopOrders);

  const dashboardStats = useAppSelector(s => s.user.dashboardStats);
  const canGenerateQR = shopDetails?.canGenerateQR === true;

  // ── Order dashboard state ──────────────────────────────────
  const [updatingId,  setUpdatingId]  = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [stationeryRequests, setStationeryRequests] = useState<StationeryRequestGroup[]>([]);
  const [resolvedStationeryRequests, setResolvedStationeryRequests] = useState<StationeryRequestGroup[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);

  const activeOrders = useMemo(() =>
    shopOrders.filter(o => !['completed', 'cancelled'].includes(o.status)),
    [shopOrders]
  );

  const todayOrderRevenue = dashboardStats?.todayRevenue ?? 0;
  const completedToday = dashboardStats?.completedToday ?? 0;
  const hasActiveRequests = stationeryRequests.length > 0;
  const hasResolvedRequests = resolvedStationeryRequests.length > 0;

  // ── QR dashboard state ─────────────────────────────────────
  const [refreshing,       setRefreshing]       = useState(false);
  const [loading,          setLoading]          = useState(true);
  const [showProfile,      setShowProfile]      = useState(false);
  const [showWallet,       setShowWallet]       = useState(false);
  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [selectedPayment,  setSelectedPayment]  = useState<QRPayment | null>(null);
  const [showQRDisplay,    setShowQRDisplay]    = useState(false);
  const [showSearch,       setShowSearch]       = useState(false);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [showNotifications,setShowNotifications]= useState(false);

  const avatarUri = resolveAvatarUrl(user?.avatarUrl);

  const activePayments   = useMemo(() => qrPayments.filter(p => p.status === 'active'), [qrPayments]);
  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) return activePayments;
    const q = searchQuery.toLowerCase();
    return activePayments.filter(p => p.title.toLowerCase().includes(q));
  }, [activePayments, searchQuery]);

  const totalCollected    = qrPayments.reduce((s, p) => s + (Number(p.totalCollected) || 0), 0);
  const activeCount       = qrPayments.filter(p => p.status === 'active').length;
  const paidCount         = qrPayments.filter(p => p.status !== 'active').length;

  const startOfToday = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayCollected = useMemo(() => {
    let sum = 0;
    for (const p of qrPayments)
      for (const payer of (p.payers || []))
        if (new Date(payer.paidAt) >= startOfToday) sum += Number(payer.amount) || 0;
    return sum;
  }, [qrPayments, startOfToday]);
  const todayPaymentCount = useMemo(() => {
    let count = 0;
    for (const p of qrPayments)
      for (const payer of (p.payers || []))
        if (new Date(payer.paidAt) >= startOfToday) count += 1;
    return count;
  }, [qrPayments, startOfToday]);

  // Auto-dismiss QR display modal when payment is received
  useEffect(() => {
    if (!selectedPayment || !showQRDisplay) return;
    const fresh = qrPayments.find(p => p.id === selectedPayment.id);
    if (fresh && fresh.status !== 'active' && selectedPayment.status === 'active') {
      setShowQRDisplay(false); setSelectedPayment(null);
    }
  }, [qrPayments, selectedPayment, showQRDisplay]);

  const loadStationeryRequests = useCallback(async () => {
    try {
      const [activeData, resolvedData] = await Promise.all([
        stationeryRequestService.listForShop(undefined, 'active'),
        stationeryRequestService.listForShop(undefined, 'resolved'),
      ]);
      setStationeryRequests(activeData);
      setResolvedStationeryRequests(resolvedData);
    } catch {
      setStationeryRequests([]);
      setResolvedStationeryRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  // ── Data fetch ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      await Promise.all([
        dispatch(fetchShopDetails()),
        dispatch(fetchQRPayments()),
        dispatch(fetchWalletBalance()),
        dispatch(fetchActiveShopOrders()),
        dispatch(fetchDashboardStats()),
        loadStationeryRequests(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [dispatch, loadStationeryRequests]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useFocusEffect(useCallback(() => {
    dispatch(fetchWalletBalance());
    dispatch(fetchQRPayments());
    dispatch(fetchActiveShopOrders());
    dispatch(fetchDashboardStats());
    loadStationeryRequests();
  }, [dispatch, loadStationeryRequests]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        dispatch(fetchQRPayments());
        dispatch(fetchWalletBalance());
        dispatch(fetchActiveShopOrders());
        loadStationeryRequests();
      }
    });
    return () => sub.remove();
  }, [dispatch, loadStationeryRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    setVisibleCount(20);
    await fetchData();
    setRefreshing(false);
  };

  // ── Order actions ──────────────────────────────────────────
  const handleAccept = useCallback(async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      await dispatch(acceptAllItems({ orderId })).unwrap();
      dispatch(fetchActiveShopOrders());
    } catch { Alert.alert('Error', 'Failed to accept order'); }
    setUpdatingId(null);
  }, [dispatch]);

  const handleReject = useCallback(async (orderId: string) => {
    Alert.alert('Reject Order', 'This will cancel the order and refund the student.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          setUpdatingId(orderId);
          try {
            await dispatch(rejectAllItems({ orderId })).unwrap();
            dispatch(fetchActiveShopOrders());
          } catch { Alert.alert('Error', 'Failed to reject order'); }
          setUpdatingId(null);
        },
      },
    ]);
  }, [dispatch]);

  const handleComplete = useCallback(async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      await dispatch(completeOrder({ orderId })).unwrap();
      dispatch(fetchActiveShopOrders());
    } catch { Alert.alert('Error', 'Failed to complete order'); }
    setUpdatingId(null);
  }, [dispatch]);

  const handleReady = useCallback(async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      await dispatch(updateOrderStatus({ orderId, status: 'ready' })).unwrap();
      dispatch(fetchActiveShopOrders());
    } catch { Alert.alert('Error', 'Failed to mark order ready'); }
    setUpdatingId(null);
  }, [dispatch]);

  const handleResolveRequest = useCallback((request: StationeryRequestGroup) => {
    Alert.alert(
      'Resolve Request',
      `Mark "${request.message}" as handled for all matching student requests?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            setResolvingRequestId(request.id);
            try {
              await stationeryRequestService.resolve(request.id);
              await loadStationeryRequests();
            } catch {
              Alert.alert('Error', 'Failed to resolve stationery request');
            } finally {
              setResolvingRequestId(null);
            }
          },
        },
      ],
    );
  }, [loadStationeryRequests]);

  const formatRequestTimeLeft = useCallback((expiresAt: string) => {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expires soon';
    const totalMinutes = Math.ceil(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m left`;
    if (minutes === 0) return `${hours}h left`;
    return `${hours}h ${minutes}m left`;
  }, []);

  const formatLatestRequestTime = useCallback((createdAt: string) => (
    new Date(createdAt).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase()
  ), []);

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  // ── Shared header ──────────────────────────────────────────
  const header = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Image source={require('../../assets/icons/appicon.png')} style={styles.logoImg} resizeMode="contain" />
        <TouchableOpacity style={styles.walletPill} onPress={() => setShowWallet(true)} activeOpacity={0.8}>
          <Icon name={canGenerateQR ? 'briefcase-outline' : 'bag-outline'} size={13} color={canGenerateQR ? '#f97316' : colors.accent} />
          <Text style={[styles.walletPillText, !canGenerateQR && { color: colors.accent }]}>
            Rs. {canGenerateQR ? todayCollected : todayOrderRevenue}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowSearch(!showSearch)} activeOpacity={0.7}>
          <Icon name="search" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => navigation.navigate('StationeryAnalytics')}
          activeOpacity={0.7}>
          <Icon name="time-outline" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileIcon} onPress={() => setShowProfile(true)} activeOpacity={0.7}>
          {avatarUri
            ? <Image source={{ uri: avatarUri }} style={styles.profileAvatarImg} />
            : <Text style={styles.profileInitial}>{user?.name?.[0]?.toUpperCase() || 'S'}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );

  const searchBar = showSearch && (
    <View style={styles.searchBarRow}>
      <View style={styles.searchBar}>
        <Icon name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={canGenerateQR ? 'Search payments...' : 'Search by token or order #...'}
          placeholderTextColor={colors.mutedForeground}
          autoFocus
        />
      </View>
      <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); }} activeOpacity={0.7}>
        <Text style={styles.searchCancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Modals (shared) ────────────────────────────────────────
  const modals = (
    <>
      <OwnerProfileDropdown
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onOpenWallet={() => { setShowProfile(false); setShowWallet(true); }}
        onNavigateNotifications={() => { setShowProfile(false); setShowNotifications(true); }}
      />
      <NotificationsModal visible={showNotifications} onClose={() => setShowNotifications(false)} />
      <OwnerWalletModal visible={showWallet} onClose={() => setShowWallet(false)} />
      <CreateQRPaymentModal visible={showCreateModal} onClose={() => { setShowCreateModal(false); dispatch(fetchQRPayments()); }} />
      <QRPaymentDisplayModal
        visible={showQRDisplay}
        payment={selectedPayment}
        onClose={() => { setShowQRDisplay(false); setSelectedPayment(null); }}
      />
    </>
  );

  // ============================================================
  // ORDER DASHBOARD (canGenerateQR === false)
  // ============================================================
  if (!canGenerateQR) {
    const filteredBySearch = searchQuery.trim()
      ? activeOrders.filter(o =>
          o.pickupToken?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : activeOrders;

    const visibleOrders = filteredBySearch.slice(0, visibleCount);
    const hasMore = filteredBySearch.length > visibleCount;

    return (
      <ScreenWrapper>
        {header}
        {searchBar}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats card */}
          <LinearGradient
            colors={['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.totalCard}
          >
            <View style={styles.totalCardHeader}>
              <Icon name="cube-outline" size={18} color={colors.accent} />
              <Text style={styles.totalCardLabel}>Today's Orders</Text>
            </View>
            <Text style={styles.totalCardAmount}>Rs. {todayOrderRevenue}</Text>
            <Text style={styles.totalCardSub}>{completedToday} completed · {activeOrders.length} active</Text>
          </LinearGradient>

          <View style={styles.requestSection}>
            <View style={styles.requestSectionHeader}>
              <View style={styles.requestSectionTitleRow}>
                <Icon name="chatbox-ellipses-outline" size={18} color={colors.foreground} />
                <Text style={styles.requestSectionTitle}>Student Requests</Text>
              </View>
              <Text style={styles.requestSectionMeta}>Active for 24 hours</Text>
            </View>

            {requestsLoading ? (
              <View style={styles.requestLoadingState}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : hasActiveRequests ? (
              stationeryRequests.map(request => (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestCountBadge}>
                    <Text style={styles.requestCountBadgeText}>{request.count}</Text>
                  </View>
                  <Text style={styles.requestCardTitle} numberOfLines={2}>{request.message}</Text>
                  <Text style={styles.requestCardMeta}>
                    {request.count === 1 ? '1 student' : `${request.count} students`} requested this
                  </Text>
                  <Text style={styles.requestCardStudents} numberOfLines={2}>
                    {request.studentNames.join(', ')}
                  </Text>
                  <View style={styles.requestCardFooter}>
                    <View style={styles.requestCardTimeBlock}>
                      <Text style={styles.requestCardTimeText}>Latest: {formatLatestRequestTime(request.latestCreatedAt)}</Text>
                      <Text style={styles.requestCardExpiryText}>{formatRequestTimeLeft(request.expiresAt)}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.requestResolveBtn, resolvingRequestId === request.id && styles.requestResolveBtnDisabled]}
                      disabled={resolvingRequestId === request.id}
                      onPress={() => handleResolveRequest(request)}
                      activeOpacity={0.8}
                    >
                      {resolvingRequestId === request.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.requestResolveBtnText}>Resolve</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.requestEmptyState}>
                <Text style={styles.requestEmptyTitle}>No active stationery requests</Text>
                <Text style={styles.requestEmptyText}>Student request cards will appear here for 24 hours.</Text>
              </View>
            )}
          </View>

          <View style={styles.requestSection}>
            <View style={styles.requestSectionHeader}>
              <View style={styles.requestSectionTitleRow}>
                <Icon name="checkmark-done-circle-outline" size={18} color="#10b981" />
                <Text style={styles.requestSectionTitle}>Resolved Requests</Text>
              </View>
              <Text style={styles.requestSectionMeta}>Visible until 24h expiry</Text>
            </View>

            {requestsLoading ? (
              <View style={styles.requestLoadingState}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : hasResolvedRequests ? (
              resolvedStationeryRequests.map(request => (
                <View key={request.id} style={[styles.requestCard, styles.requestResolvedCard]}>
                  <View style={styles.requestCountBadge}>
                    <Text style={styles.requestCountBadgeText}>{request.count}</Text>
                  </View>
                  <Text style={styles.requestCardTitle} numberOfLines={2}>{request.message}</Text>
                  <Text style={styles.requestResolvedMeta}>Resolved</Text>
                  <Text style={styles.requestCardStudents} numberOfLines={2}>
                    {request.studentNames.join(', ')}
                  </Text>
                  <Text style={styles.requestCardExpiryText}>{formatRequestTimeLeft(request.expiresAt)}</Text>
                </View>
              ))
            ) : (
              <View style={styles.requestEmptyState}>
                <Text style={styles.requestEmptyTitle}>No resolved requests</Text>
                <Text style={styles.requestEmptyText}>Resolved request cards will stay here until their 24-hour expiry.</Text>
              </View>
            )}
          </View>

          {/* Order cards */}
          {filteredBySearch.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="checkmark-circle-outline" size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No active orders</Text>
              <Text style={styles.emptySubtext}>Orders appear here when students place them</Text>
            </View>
          ) : (
            <>
              {visibleOrders.map(order => {
                const cfg = getSwipeCfg(order, handleAccept, handleReject, handleReady, handleComplete);
                return (
                  <SwipeableOrderCard
                    key={order.id}
                    order={order}
                    swipeRight={cfg.right}
                    swipeLeft={cfg.left}
                    colors={colors}
                    styles={styles}
                    isUpdating={updatingId === order.id}
                  />
                );
              })}
              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => setVisibleCount(c => c + 20)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loadMoreText}>
                    Load More ({filteredBySearch.length - visibleCount} remaining)
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
        {modals}
      </ScreenWrapper>
    );
  }

  // ============================================================
  // QR PAYMENT DASHBOARD (canGenerateQR === true)
  // ============================================================
  return (
    <ScreenWrapper>
      {header}
      {searchBar}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Today's Collection Card */}
        <LinearGradient
          colors={['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.totalCard}
        >
          <View style={styles.totalCardHeader}>
            <Icon name="logo-usd" size={18} color="#10b981" />
            <Text style={styles.totalCardLabel}>Today's Collection</Text>
          </View>
          <Text style={styles.totalCardAmount}>Rs. {todayCollected}</Text>
          <Text style={styles.totalCardSub}>{todayPaymentCount} payments today</Text>
        </LinearGradient>

        {/* QR Overview */}
        <LinearGradient
          colors={['rgba(139,92,246,0.15)', 'rgba(139,92,246,0.05)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.overviewCard}
        >
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>QR PAYMENT OVERVIEW</Text>
            <TouchableOpacity onPress={onRefresh} activeOpacity={0.7}>
              <Icon name="refresh-outline" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={styles.statsRow}>
            <StatItem value={qrPayments.length} label="Total QR"  color="#8b5cf6" />
            <StatItem value={paidCount}          label="Paid"      color="#22c55e" />
            <StatItem value={activeCount}        label="Active"    color="#3b82f6" />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#f97316' }}>₹</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#f97316' }}>{totalCollected}</Text>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '500', color: colors.mutedForeground, marginTop: 2 }}>Collected</Text>
            </View>
          </View>
        </LinearGradient>

        {/* QR Payments List */}
        <View style={styles.qrSection}>
          <View style={styles.qrSectionHeader}>
            <View style={styles.qrSectionTitleRow}>
              <Icon name="qr-code-outline" size={20} color={colors.foreground} />
              <Text style={styles.qrSectionTitle}>QR Payments</Text>
            </View>
            <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)} activeOpacity={0.7}>
              <Icon name="add" size={16} color="#fff" />
              <Text style={styles.createBtnText}>Create</Text>
            </TouchableOpacity>
          </View>

          {qrPaymentsLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 20 }} />
          ) : filteredPayments.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="qr-code-outline" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>{searchQuery ? 'No matching payments' : 'No active QR payments'}</Text>
              <Text style={styles.emptySubtext}>{searchQuery ? 'Try a different search term' : 'Tap "+ Create" to generate your first QR payment'}</Text>
            </View>
          ) : (
            filteredPayments.map(payment => (
              <QRPaymentCard
                key={payment.id}
                payment={payment}
                colors={colors}
                styles={styles}
                onPress={() => { setSelectedPayment(payment); setShowQRDisplay(true); }}
              />
            ))
          )}
        </View>
      </ScrollView>
      {modals}
    </ScreenWrapper>
  );
}

// ============================================================
// STYLES
// ============================================================

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 32, height: 32, borderRadius: 16 },
  walletPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.12)',
  },
  walletPillText: { fontSize: 12, fontWeight: '700', color: '#f97316' },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center',
  },
  profileIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  profileAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  profileInitial: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Search
  searchBarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, marginBottom: 8,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 24, backgroundColor: colors.muted,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.foreground, padding: 0 },
  searchCancelText: { fontSize: 14, fontWeight: '600', color: colors.foreground },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 16 },

  // Stats card
  totalCard: {
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },
  totalCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  totalCardLabel:  { fontSize: 13, fontWeight: '500', color: colors.mutedForeground },
  totalCardAmount: { fontSize: 32, fontWeight: '900', color: colors.foreground, marginBottom: 4 },
  totalCardSub:    { fontSize: 12, fontWeight: '500', color: '#10b981' },

  // Filter tabs (order dashboard)
  filterRow: { flexDirection: 'row', gap: 10 },
  filterTab: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  filterTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterLabel:     { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  filterLabelActive: { color: '#fff' },

  // Swipeable card
  swipeContainer: { position: 'relative', marginBottom: 10 },
  swipeBg: {
    position: 'absolute', inset: 0,
    borderRadius: 14, flexDirection: 'row', alignItems: 'center',
  },
  swipeBgLeft:  { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, gap: 8 },
  swipeBgRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 20, gap: 8 },
  swipeBgText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
  orderCard: {
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  updatingOverlay: {
    position: 'absolute', inset: 0, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  orderToken:    { fontSize: 13, fontWeight: '800', color: colors.foreground },
  orderTime:     { fontSize: 12, color: colors.mutedForeground },
  orderCustomer: { flex: 1, fontSize: 12, color: colors.mutedForeground },
  orderTotal:    { fontSize: 14, fontWeight: '800', color: colors.accent },
  itemsList:     { paddingHorizontal: 14, paddingVertical: 8, gap: 4 },
  orderNoteBox: {
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderNoteLabel: { fontSize: 11, fontWeight: '700', color: colors.accent, marginBottom: 4, textTransform: 'uppercase' },
  orderNoteText: { fontSize: 12, lineHeight: 18, color: colors.foreground },
  itemRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemQty:       { fontSize: 12, fontWeight: '700', color: colors.accent, width: 24 },
  itemName:      { flex: 1, fontSize: 13, color: colors.foreground },
  itemPrice:     { fontSize: 12, color: colors.mutedForeground },
  swipeHint:     { fontSize: 10, color: colors.mutedForeground, textAlign: 'center', paddingBottom: 8 },

  // Empty state
  emptyState:  { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle:  { fontSize: 15, fontWeight: '600', color: colors.foreground },
  emptySubtext:{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center' },
  requestSection: { gap: 12 },
  requestSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestSectionTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  requestSectionMeta: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
  requestLoadingState: {
    paddingVertical: 24,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  requestEmptyState: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  requestEmptyTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  requestEmptyText: { fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  requestCard: {
    position: 'relative',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  requestCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  requestCountBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  requestCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.foreground,
    paddingRight: 44,
  },
  requestCardMeta: { fontSize: 12, fontWeight: '600', color: colors.accent },
  requestResolvedMeta: { fontSize: 12, fontWeight: '800', color: '#10b981' },
  requestCardStudents: { fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  requestResolvedCard: { borderColor: 'rgba(16,185,129,0.35)', backgroundColor: 'rgba(16,185,129,0.08)' },
  requestCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  requestCardTimeBlock: { flex: 1, gap: 2 },
  requestCardTimeText: { fontSize: 11, color: colors.mutedForeground },
  requestCardExpiryText: { fontSize: 11, fontWeight: '700', color: '#f97316' },
  requestResolveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
  },
  requestResolveBtnDisabled: { opacity: 0.75 },
  requestResolveBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  loadMoreBtn: {
    marginTop: 8, marginBottom: 4, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: colors.accent },

  // QR Overview card
  overviewCard: {
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)',
  },
  overviewHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  overviewTitle: { fontSize: 11, fontWeight: '800', color: colors.mutedForeground, letterSpacing: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },

  // QR section
  qrSection: { marginTop: 4 },
  qrSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  qrSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qrSectionTitle: { fontSize: 17, fontWeight: '800', color: colors.foreground },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#3b82f6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  createBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // QR Card
  qrCard: {
    backgroundColor: colors.muted, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  qrCardBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  qrTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(6,182,212,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  qrTypeBadgeText: { fontSize: 9, fontWeight: '700', color: '#06b6d4' },
  statusBadgePaid: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  paidBadgeText: { fontSize: 9, fontWeight: '700', color: '#22c55e' },
  qrCardTitle:  { fontSize: 15, fontWeight: '700', color: colors.foreground, marginBottom: 2 },
  qrCardAmount: { fontSize: 13, fontWeight: '500', color: colors.mutedForeground },
  payerSection: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  payerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3,
  },
  payerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  payerName: { fontSize: 13, fontWeight: '600', color: colors.foreground, flex: 1 },
  payerDate: { fontSize: 11, color: colors.mutedForeground },
  morePayersText: { fontSize: 11, color: colors.mutedForeground, marginTop: 4 },
});
