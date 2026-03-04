import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, Easing, Dimensions, TouchableOpacity, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Sound from 'react-native-sound';
import Icon from './Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { CartItem, Order } from '../../types';

Sound.setCategory('Playback');

const { width } = Dimensions.get('window');

interface OrderDetails {
  orderId: string;
  pickupToken: string;
  shopId?: string;
  shopName?: string;
  total: number;
  items: CartItem[];
}

interface OrderAnimationProps {
  type: 'success' | 'failure';
  /** 'instant' = Ready for Pickup (orange), 'regular' = Order Confirmed (blue), 'split' = both tokens */
  orderType?: 'instant' | 'regular' | 'split';
  pickupToken?: string;
  orderId?: string;
  total?: number;
  /** For split orders: pass both orders to show both tokens on one screen */
  splitOrders?: Order[];
  orderDetails?: OrderDetails;
  errorMessage?: string;
  onComplete?: () => void;
}

export function OrderAnimation({ type, orderType = 'instant', pickupToken, orderId, total, splitOrders, orderDetails: _orderDetails, errorMessage, onComplete }: OrderAnimationProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Progress bar for success screen
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  const iconScale = useMemo(() => new Animated.Value(0.4), []);
  const iconOpacity = useMemo(() => new Animated.Value(0), []);
  const contentOpacity = useMemo(() => new Animated.Value(0), []);
  const toastSlide = useMemo(() => new Animated.Value(60), []);

  // Failure animations
  const shakeAnim = useMemo(() => new Animated.Value(0), []);
  const failOpacity = useMemo(() => new Animated.Value(0), []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const soundRef = useRef<Sound | null>(null);

  useEffect(() => {
    if (type === 'success') {
      // Play notification sound
      const sound = new Sound('notification_sound.wav', Sound.MAIN_BUNDLE, (error) => {
        if (!error) {
          sound.setVolume(1.0);
          sound.play(() => sound.release());
        }
      });
      soundRef.current = sound;

      // Animate icon in
      Animated.parallel([
        Animated.spring(iconScale, { toValue: 1, friction: 4, useNativeDriver: true }),
        Animated.timing(iconOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();

      // Fade in content after 300ms
      progressTimerRef.current = setTimeout(() => {
        Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        // Slide up toast
        Animated.spring(toastSlide, { toValue: 0, friction: 6, useNativeDriver: true }).start();
      }, 400);

      // Progress bar (non-native driver, separate from above)
      animRef.current = Animated.timing(progressAnim, {
        toValue: width * 0.55,
        duration: 4500,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      animRef.current.start();

      // Auto dismiss after 5 seconds
      timerRef.current = setTimeout(() => {
        onComplete?.();
      }, 5000);
    } else {
      // Failure: shake + fade in
      Animated.timing(failOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 12, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -12, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
      timerRef.current = setTimeout(() => onComplete?.(), 2800);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
      animRef.current?.stop();
      soundRef.current?.release();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    animRef.current?.stop();
    onComplete?.();
  };

  if (type === 'success') {
    const isSplit = orderType === 'split' && splitOrders && splitOrders.length > 1;
    const isInstant = orderType === 'instant';

    // For split orders, find instant and regular
    const instantOrder = isSplit ? splitOrders!.find(o => o.isReadyServe) : null;
    const regularOrder = isSplit ? splitOrders!.find(o => !o.isReadyServe) : null;

    if (isSplit) {
      // ── Split order: single dark screen with both token cards ──
      const combinedTotal = splitOrders!.reduce((sum, o) => sum + o.total, 0);
      const orderIds = splitOrders!.map(o => o.id).join(' & ');

      return (
        <Modal visible transparent animationType="fade" statusBarTranslucent>
          <View style={styles.splitOverlay}>
            <ScrollView contentContainerStyle={styles.splitScrollContent} showsVerticalScrollIndicator={false}>
              {/* Animated icon */}
              <Animated.View style={[styles.splitIconCircle, { transform: [{ scale: iconScale }], opacity: iconOpacity }]}>
                <Icon name="checkmark-circle" size={56} color="#3b82f6" />
              </Animated.View>

              <Animated.View style={[styles.mainContent, { opacity: contentOpacity }]}>
                {/* Title */}
                <Text style={styles.splitTitle}>Order Confirmed</Text>
                <Text style={styles.splitSub}>Your order has been placed successfully</Text>

                {/* Instant token card */}
                {instantOrder && (
                  <LinearGradient
                    colors={['#f97316', '#f59e0b']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.splitTokenCard}>
                    <View style={styles.splitTokenHeader}>
                      <Icon name="flash" size={16} color="#fff" />
                      <Text style={styles.splitTokenLabel}>READY TO SERVE</Text>
                    </View>
                    <Text style={styles.splitTokenValue}>{instantOrder.pickupToken}</Text>
                    <Text style={styles.splitTokenHint}>Collect now at the counter</Text>
                  </LinearGradient>
                )}

                {/* Regular token card */}
                {regularOrder && (
                  <LinearGradient
                    colors={['#3b82f6', '#2563eb']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.splitTokenCard}>
                    <Text style={styles.splitTokenLabel}>BEING PREPARED</Text>
                    <Text style={styles.splitTokenValue}>{regularOrder.pickupToken}</Text>
                    <Text style={styles.splitTokenHint}>We'll notify you when ready</Text>
                  </LinearGradient>
                )}

                {/* Split info */}
                <Text style={styles.splitInfoText}>
                  Your order was split — <Text style={{ color: '#f97316', fontWeight: '700' }}>instant items</Text> are ready now!
                </Text>

                {/* Done button */}
                <TouchableOpacity style={styles.splitDoneBtn} onPress={handleDismiss} activeOpacity={0.8}>
                  <Text style={styles.splitDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </Animated.View>
            </ScrollView>

            {/* Money Deducted toast */}
            <Animated.View style={[styles.moneyToast, { transform: [{ translateY: toastSlide }] }]}>
              <View style={styles.moneyToastIconWrap}>
                <Icon name="card" size={20} color="#10b981" />
              </View>
              <View style={styles.moneyToastText}>
                <Text style={styles.moneyToastTitle}>Money Deducted</Text>
                <Text style={styles.moneyToastSub} numberOfLines={2}>
                  Payment for orders {orderIds}
                  {combinedTotal ? ` · Rs.${combinedTotal}` : ''}
                </Text>
              </View>
            </Animated.View>
          </View>
        </Modal>
      );
    }

    // ── Single order (instant or regular) ──
    const gradientColors = isInstant ? ['#f97316', '#fbbf24'] : ['#3b82f6', '#06b6d4'];
    const mainIcon = isInstant ? 'flash' : 'checkmark-circle';
    const titleText = isInstant ? 'Ready for Pickup!' : 'Order Confirmed!';
    const subText = isInstant
      ? 'Head to the counter now to collect your order!'
      : 'We\'ll notify you when your order is ready.';

    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity activeOpacity={1} onPress={handleDismiss} style={styles.touchFill}>
          <LinearGradient colors={gradientColors} style={styles.orangeOverlay}>
            {/* Animated icon */}
            <Animated.View style={[styles.iconCircleOrange, { transform: [{ scale: iconScale }], opacity: iconOpacity }]}>
              <Icon name={mainIcon} size={56} color="rgba(255,255,255,0.95)" />
            </Animated.View>

            <Animated.View style={[styles.mainContent, { opacity: contentOpacity }]}>
              {/* Order number */}
              {orderId && (
                <Text style={styles.orderNum}>ORDER #{orderId.slice(-16).toUpperCase()}</Text>
              )}

              {/* Title */}
              <Text style={styles.readyTitle}>{titleText}</Text>

              {/* Subtitle */}
              <Text style={styles.readySub}>{subText}</Text>

              {/* Pickup Token Card - shown for regular orders */}
              {!isInstant && pickupToken ? (
                <View style={styles.tokenCardWrap}>
                  <View style={styles.tokenCard}>
                    <Text style={styles.tokenCardLabel}>PICKUP TOKEN</Text>
                    <Text style={styles.tokenCardValue}>{pickupToken}</Text>
                    <Text style={styles.tokenCardHint}>Show this at the counter</Text>
                  </View>
                </View>
              ) : null}

              {/* Tap to dismiss */}
              <Text style={styles.tapDismiss}>Tap anywhere to dismiss</Text>

              {/* Progress bar */}
              <View style={styles.progressWrap}>
                <Animated.View style={[styles.progressFill, { width: progressAnim }]} />
              </View>
            </Animated.View>

            {/* Money Deducted toast */}
            <Animated.View style={[styles.moneyToast, { transform: [{ translateY: toastSlide }] }]}>
              <View style={styles.moneyToastIconWrap}>
                <Icon name="card" size={20} color="#10b981" />
              </View>
              <View style={styles.moneyToastText}>
                <Text style={styles.moneyToastTitle}>Money Deducted</Text>
                <Text style={styles.moneyToastSub} numberOfLines={1}>
                  Payment for order {orderId || 'your order'}
                  {total ? ` · Rs.${total}` : ''}
                </Text>
              </View>
            </Animated.View>
          </LinearGradient>
        </TouchableOpacity>
      </Modal>
    );
  }

  // Failure screen
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <Animated.View style={[styles.failOverlay, { opacity: failOpacity }]}>
        <Animated.View style={[styles.failContent, { transform: [{ translateX: shakeAnim }] }]}>
          <View style={styles.failIconCircle}>
            <Icon name="close-circle" size={64} color={colors.destructive} />
          </View>
          <Text style={styles.failTitle}>Order Failed</Text>
          <Text style={styles.failSub}>Something went wrong. Please try again.</Text>
          {errorMessage ? (
            <Text style={styles.failHint}>{errorMessage}</Text>
          ) : (
            <Text style={styles.failHint}>Insufficient balance or item unavailable</Text>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export function LoadingSpinner({ size = 32, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const resolvedColor = color ?? colors.primary;
  const spinValue = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinValue, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.spinnerContainer}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <View style={[styles.spinnerCircle, { width: size, height: size, borderRadius: size / 2, borderTopColor: resolvedColor }]} />
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  touchFill: { flex: 1 },

  // ── Success (orange) ──
  orangeOverlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircleOrange: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 32,
  },
  mainContent: { alignItems: 'center', width: '100%' },
  orderNum: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10,
  },
  readyTitle: {
    fontSize: 32, fontWeight: '900', color: '#fff',
    textAlign: 'center', marginBottom: 14, letterSpacing: 0.5,
  },
  readySub: {
    fontSize: 15, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', lineHeight: 22, marginBottom: 32,
  },
  tapDismiss: {
    fontSize: 13, color: 'rgba(255,255,255,0.5)',
    textAlign: 'center', marginBottom: 16,
  },
  // Token card (for regular/time-taking orders)
  tokenCardWrap: {
    width: '100%', alignItems: 'center', marginBottom: 24,
  },
  tokenCard: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingVertical: 20, paddingHorizontal: 32, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  tokenCardLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  tokenCardValue: {
    fontSize: 44, fontWeight: '900', color: '#fff',
    letterSpacing: 6, marginTop: 4,
  },
  tokenCardHint: {
    fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6,
  },

  // ── Split order screen (dark background, both tokens) ──
  splitOverlay: {
    flex: 1, backgroundColor: '#0a0a0f',
  },
  splitScrollContent: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingVertical: 48, paddingBottom: 100,
  },
  splitIconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 3, borderColor: 'rgba(59,130,246,0.35)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  splitTitle: {
    fontSize: 28, fontWeight: '900', color: '#fff',
    textAlign: 'center', marginBottom: 8,
  },
  splitSub: {
    fontSize: 14, color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', marginBottom: 28,
  },
  splitTokenCard: {
    width: '100%', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 24,
    alignItems: 'center', marginBottom: 16,
  },
  splitTokenHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2,
  },
  splitTokenLabel: {
    fontSize: 12, fontWeight: '800', color: '#fff',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  splitTokenValue: {
    fontSize: 48, fontWeight: '900', color: '#fff',
    letterSpacing: 4, marginTop: 2,
  },
  splitTokenHint: {
    fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4,
  },
  splitInfoText: {
    fontSize: 13, color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', marginTop: 12, marginBottom: 24, lineHeight: 20,
  },
  splitDoneBtn: {
    backgroundColor: '#3b82f6', borderRadius: 14,
    paddingHorizontal: 40, paddingVertical: 12,
  },
  splitDoneBtnText: {
    fontSize: 15, fontWeight: '700', color: '#fff',
  },
  progressWrap: {
    width: '55%', height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden',
  },
  progressFill: {
    height: 4, borderRadius: 2, backgroundColor: '#fff',
  },

  // Money Deducted toast
  moneyToast: {
    position: 'absolute', bottom: 32, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#0f0f14', borderRadius: 18,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  moneyToastIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  moneyToastText: { flex: 1 },
  moneyToastTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  moneyToastSub: { fontSize: 12, color: '#6b7280' },

  // ── Failure ──
  failOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
  failContent: { alignItems: 'center', paddingHorizontal: 32 },
  failIconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(239,68,68,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  failTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },
  failSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8 },
  failHint: { fontSize: 13, color: colors.destructive, textAlign: 'center', marginTop: 6 },

  // Spinner
  spinnerContainer: { padding: 16, alignItems: 'center' },
  spinnerCircle: { borderWidth: 3, borderColor: 'rgba(16,185,129,0.2)' },
});
