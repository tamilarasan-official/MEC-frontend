import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, Easing, Dimensions,
} from 'react-native';
import Icon from './Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { CartItem } from '../../types';

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
  orderDetails?: OrderDetails;
  onComplete?: () => void;
}

export function OrderAnimation({ type, pickupToken, orderDetails: _orderDetails, onComplete }: OrderAnimationProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stage, setStage] = useState(0);
  const [showQRCard, setShowQRCard] = useState(false);
  const scaleAnim = useState(new Animated.Value(0.3))[0];
  const opacityAnim = useState(new Animated.Value(0))[0];
  const tokenSlide = useState(new Animated.Value(40))[0];
  const shakeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (type === 'success') {
      const timers = [
        setTimeout(() => setStage(1), 300),
        setTimeout(() => setStage(2), 800),
        setTimeout(() => setStage(3), 1300),
        setTimeout(() => setShowQRCard(true), 3500),
      ];
      // Bounce in
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      Animated.timing(opacityAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      return () => timers.forEach(clearTimeout);
    } else {
      const timers = [
        setTimeout(() => setStage(1), 300),
        setTimeout(() => onComplete?.(), 2500),
      ];
      // Shake animation for failure
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      return () => timers.forEach(clearTimeout);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    if (stage === 3 && pickupToken) {
      Animated.parallel([
        Animated.spring(tokenSlide, { toValue: 0, friction: 5, useNativeDriver: true }),
      ]).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, pickupToken]);

  // If showQRCard, delegate to onComplete (caller should show OrderQRCard)
  useEffect(() => {
    if (showQRCard && type === 'success') {
      onComplete?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQRCard]);

  if (type === 'success') {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <Animated.View style={[styles.content, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
            {/* Icon */}
            <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
              {stage < 2 ? (
                <Icon name="cube-outline" size={64} color={colors.primary} />
              ) : (
                <Icon name="checkmark-circle" size={64} color={colors.primary} />
              )}
            </View>

            {/* Text */}
            {stage >= 2 && (
              <>
                <Text style={styles.title}>Order Confirmed</Text>
                <Text style={styles.subtitle}>Your order has been placed successfully</Text>
              </>
            )}

            {/* Pickup Token Card */}
            {pickupToken && stage >= 3 && (
              <Animated.View style={[styles.tokenCard, { transform: [{ translateY: tokenSlide }] }]}>
                <Text style={styles.tokenLabel}>PICKUP TOKEN</Text>
                <Text style={styles.tokenValue}>{pickupToken}</Text>
                <Text style={styles.tokenHint}>Show this code at the counter</Text>
              </Animated.View>
            )}

            {stage >= 3 && (
              <Text style={styles.timeHint}>
                Get ready in <Text style={styles.timeHighlight}>15-20 min</Text>
              </Text>
            )}
          </Animated.View>
        </View>
      </Modal>
    );
  }

  // Failure
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.content, { opacity: opacityAnim, transform: [{ translateX: shakeAnim }] }]}>
          <View style={[styles.iconCircle, styles.iconCircleFailure]}>
            <Icon name="close-circle" size={64} color={colors.destructive} />
          </View>
          {stage >= 1 && (
            <>
              <Text style={styles.title}>Order Failed</Text>
              <Text style={styles.subtitle}>Something went wrong. Please try again.</Text>
              <Text style={[styles.subtitle, styles.failureHint]}>
                Insufficient balance or item unavailable
              </Text>
            </>
          )}
        </Animated.View>
      </View>
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
  overlay: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.96)', justifyContent: 'center', alignItems: 'center',
  },
  content: { alignItems: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.foreground, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginTop: 8 },
  tokenCard: {
    width: width * 0.75, backgroundColor: colors.blue[500], borderRadius: 20, padding: 24,
    alignItems: 'center', marginTop: 24, shadowColor: colors.blue[500], shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  tokenLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 2 },
  tokenValue: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: 6, marginVertical: 8 },
  tokenHint: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  timeHint: { fontSize: 13, color: colors.mutedForeground, marginTop: 16 },
  timeHighlight: { color: colors.primary, fontWeight: '700' },
  iconCircleSuccess: { backgroundColor: 'rgba(16,185,129,0.15)' },
  iconCircleFailure: { backgroundColor: 'rgba(239,68,68,0.15)' },
  failureHint: { color: colors.destructive, marginTop: 4 },
  spinnerContainer: { padding: 16, alignItems: 'center' },
  spinnerCircle: { borderWidth: 3, borderColor: 'rgba(16,185,129,0.2)' },
});
