import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, AppState, Alert,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../../store';
import {
  fetchActiveShopOrders, updateOrderStatus, completeOrder, acceptAllItems, rejectAllItems,
} from '../../store/slices/ordersSlice';
import { fetchDashboardStats } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import CaptainHeader from '../../components/captain/CaptainHeader';
import CaptainProfileDropdown from '../../components/captain/CaptainProfileDropdown';
import NotificationsModal from '../../components/student/NotificationsModal';
import { Order, StationeryRequestGroup } from '../../types';
import { mediumHaptic } from '../../utils/haptics';
import stationeryRequestService from '../../services/stationeryRequestService';

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
  if (['preparing', 'partially_ready'].includes(order.status)) return {
    right: { label: 'Ready', icon: 'checkmark-circle', color: '#0ea5e9', onAction: () => onReady(order.id) },
    left: null,
  };
  if (['ready', 'partially_delivered'].includes(order.status)) return {
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
        <View style={styles.cardHeader}>
          <Text style={styles.orderToken}>#{order.pickupToken}</Text>
          <Text style={styles.orderTime}>{timeStr}</Text>
          <Text style={styles.orderCustomer} numberOfLines={1}>{order.userName || '—'}</Text>
          <Text style={styles.orderTotal}>₹{order.total}</Text>
        </View>
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
// MAIN SCREEN
// ============================================================

export default function StationeryCaptainHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();

  const shopOrders     = useAppSelector(s => s.orders.shopOrders);
  const dashboardStats = useAppSelector(s => s.user.dashboardStats);

  const [updatingId,   setUpdatingId]   = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [refreshing,   setRefreshing]   = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [showProfile,  setShowProfile]  = useState(false);
  const [showSearch,   setShowSearch]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [stationeryRequests, setStationeryRequests] = useState<StationeryRequestGroup[]>([]);
  const [resolvedStationeryRequests, setResolvedStationeryRequests] = useState<StationeryRequestGroup[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);

  const activeOrders = useMemo(() =>
    shopOrders.filter(o => !['completed', 'cancelled'].includes(o.status)),
    [shopOrders],
  );

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return activeOrders;
    const q = searchQuery.toLowerCase();
    return activeOrders.filter(o =>
      o.pickupToken?.toLowerCase().includes(q) ||
      o.orderNumber?.toLowerCase().includes(q),
    );
  }, [activeOrders, searchQuery]);

  const visibleOrders = filteredOrders.slice(0, visibleCount);
  const hasMore = filteredOrders.length > visibleCount;

  const todayRevenue   = dashboardStats?.todayRevenue   ?? 0;
  const completedToday = dashboardStats?.completedToday ?? 0;

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

  const fetchData = useCallback(async () => {
    try {
      await Promise.all([
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
    dispatch(fetchActiveShopOrders());
    dispatch(fetchDashboardStats());
    loadStationeryRequests();
  }, [dispatch, loadStationeryRequests]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        dispatch(fetchActiveShopOrders());
        dispatch(fetchDashboardStats());
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

  return (
    <ScreenWrapper>
      <CaptainHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(s => !s)}
        onProfilePress={() => setShowProfile(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats card */}
        <LinearGradient
          colors={['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.statsCard}
        >
          <View style={styles.statsCardHeader}>
            <Icon name="cube-outline" size={18} color={colors.accent} />
            <Text style={styles.statsCardLabel}>Today's Orders</Text>
          </View>
          <Text style={styles.statsCardAmount}>₹{todayRevenue}</Text>
          <Text style={styles.statsCardSub}>{completedToday} completed · {activeOrders.length} active</Text>
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
          ) : stationeryRequests.length === 0 ? (
            <View style={styles.requestEmptyState}>
              <Text style={styles.requestEmptyTitle}>No active stationery requests</Text>
              <Text style={styles.requestEmptyText}>Student request cards will appear here for 24 hours.</Text>
            </View>
          ) : (
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
          ) : resolvedStationeryRequests.length === 0 ? (
            <View style={styles.requestEmptyState}>
              <Text style={styles.requestEmptyTitle}>No resolved requests</Text>
              <Text style={styles.requestEmptyText}>Resolved request cards will stay here until their 24-hour expiry.</Text>
            </View>
          ) : (
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
          )}
        </View>

        {/* Order cards */}
        {filteredOrders.length === 0 ? (
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
                  Load More ({filteredOrders.length - visibleCount} remaining)
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <CaptainProfileDropdown
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onNavigateNotifications={() => { setShowProfile(false); setShowNotifications(true); }}
      />
      <NotificationsModal visible={showNotifications} onClose={() => setShowNotifications(false)} />
    </ScreenWrapper>
  );
}

// ============================================================
// STYLES
// ============================================================

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 16 },

  statsCard: {
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    marginTop: 8,
  },
  statsCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statsCardLabel:  { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  statsCardAmount: { fontSize: 28, fontWeight: '800', color: colors.foreground, marginBottom: 4 },
  statsCardSub:    { fontSize: 12, color: colors.mutedForeground },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle:   { fontSize: 16, fontWeight: '600', color: colors.foreground },
  emptySubtext: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center' },
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
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.muted, alignItems: 'center',
  },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: colors.foreground },

  // Swipeable card
  swipeContainer: { borderRadius: 16, overflow: 'hidden', position: 'relative' },
  swipeBg: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20,
  },
  swipeBgLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  swipeBgRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' },
  swipeBgText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
  orderCard: {
    backgroundColor: colors.card,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  updatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 16, zIndex: 10,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 10,
  },
  orderToken:    { fontSize: 14, fontWeight: '700', color: colors.accent },
  orderTime:     { fontSize: 12, color: colors.mutedForeground },
  orderCustomer: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.foreground },
  orderTotal:    { fontSize: 14, fontWeight: '700', color: colors.foreground },
  itemsList: { gap: 4, marginBottom: 8 },
  itemRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemQty:   { fontSize: 13, fontWeight: '600', color: colors.accent, width: 28 },
  itemName:  { flex: 1, fontSize: 13, color: colors.foreground },
  itemPrice: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  orderNoteBox: {
    marginTop: 10,
    marginHorizontal: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderNoteLabel: { fontSize: 11, fontWeight: '700', color: colors.accent, marginBottom: 4, textTransform: 'uppercase' },
  orderNoteText: { fontSize: 12, lineHeight: 18, color: colors.foreground },
  swipeHint: { fontSize: 11, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 },
});
