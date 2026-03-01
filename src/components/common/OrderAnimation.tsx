import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, Easing, Dimensions, TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Sound from 'react-native-sound';
import Icon from './Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { CartItem } from '../../types';

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
  pickupToken?: string;
  orderId?: string;
  total?: number;
  orderDetails?: OrderDetails;
  errorMessage?: string;
  onComplete?: () => void;
}

export function OrderAnimation({ type, pickupToken: _pickupToken, orderId, total, orderDetails: _orderDetails, errorMessage, onComplete }: OrderAnimationProps) {
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

  useEffect(() => {
    if (type === 'success') {
      // Play notification sound
      const sound = new Sound('notification_sound.wav', Sound.MAIN_BUNDLE, (error) => {
        if (!error) {
          sound.setVolume(1.0);
          sound.play(() => sound.release());
        }
      });

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
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity activeOpacity={1} onPress={handleDismiss} style={styles.touchFill}>
          <LinearGradient colors={['#f97316', '#fbbf24']} style={styles.orangeOverlay}>
            {/* Animated icon */}
            <Animated.View style={[styles.iconCircleOrange, { transform: [{ scale: iconScale }], opacity: iconOpacity }]}>
              <Icon name="cube-outline" size={56} color="rgba(255,255,255,0.95)" />
            </Animated.View>

            <Animated.View style={[styles.mainContent, { opacity: contentOpacity }]}>
              {/* Order number */}
              {orderId && (
                <Text style={styles.orderNum}>ORDER #{orderId.slice(-16).toUpperCase()}</Text>
              )}

              {/* Title */}
              <Text style={styles.readyTitle}>Ready for Pickup!</Text>

              {/* Subtitle */}
              <Text style={styles.readySub}>Head to the counter now to collect your order!</Text>

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
    Animated.loop(
      Animated.timing(spinValue, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })
    ).start();
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
