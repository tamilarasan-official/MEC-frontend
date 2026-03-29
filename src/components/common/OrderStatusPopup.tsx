import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Vibration, Platform, StatusBar,
} from 'react-native';
import Sound from 'react-native-sound';
import Icon from './Icon';

// Enable playback in silent mode (iOS)
Sound.setCategory('Playback');

interface OrderStatusPopupProps {
  status: 'preparing' | 'partially_ready' | 'ready' | 'partially_delivered' | 'completed' | 'cancelled';
  orderNumber: string;
  itemNames?: string[];
  pickupToken?: string;
  onDismiss: () => void;
}

const statusConfig: Record<string, { icon: string; label: string; bgColors: string[] }> = {
  preparing: {
    icon: 'restaurant-outline',
    label: 'Getting Ready',
    bgColors: ['#f59e0b', '#eab308'],
  },
  partially_ready: {
    icon: 'git-branch-outline',
    label: 'Ready for Pickup!',
    bgColors: ['#8b5cf6', '#7c3aed'],
  },
  partially_delivered: {
    icon: 'cube-outline',
    label: 'Partial Pickup Done',
    bgColors: ['#3b82f6', '#2563eb'],
  },
  ready: {
    icon: 'cube-outline',
    label: 'Ready for Pickup!',
    bgColors: ['#f97316', '#ea580c'],
  },
  completed: {
    icon: 'checkmark-circle',
    label: 'Delivered!',
    bgColors: ['#22c55e', '#16a34a'],
  },
  cancelled: {
    icon: 'close-circle',
    label: 'Cancelled',
    bgColors: ['#ef4444', '#dc2626'],
  },
};

function getStatusMessage(status: string, itemsSummary: string): string {
  switch (status) {
    case 'preparing':
      return itemsSummary
        ? `Your ${itemsSummary} is being prepared!`
        : 'Your order has been confirmed and is being prepared!';
    case 'partially_ready':
      return itemsSummary
        ? `Your ${itemsSummary} is ready! Head to the counter to collect.`
        : 'Some items from your order are ready. Head to the counter!';
    case 'partially_delivered':
      return 'Some items have been handed over. Remaining items will be ready soon!';
    case 'ready':
      return itemsSummary
        ? `Your ${itemsSummary} is ready! Head to the counter now.`
        : 'All items are ready. Head to the counter now!';
    case 'completed':
      return itemsSummary
        ? `Your ${itemsSummary} has been delivered. Enjoy your meal!`
        : 'Your order has been delivered. Enjoy your meal!';
    case 'cancelled':
      return 'Your order has been cancelled. The amount will be refunded to your wallet.';
    default:
      return 'Your order status has been updated.';
  }
}

export function OrderStatusPopup({ status, orderNumber, itemNames, pickupToken, onDismiss }: OrderStatusPopupProps) {
  const config = statusConfig[status] || statusConfig.preparing;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const stableDismiss = useCallback(() => onDismissRef.current(), []);
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  const itemsSummary = useMemo(() => (itemNames || []).join(', '), [itemNames]);
  const message = useMemo(() => getStatusMessage(status, itemsSummary), [status, itemsSummary]);

  // Show food item names as headline (or fall back to order number)
  const headline = itemNames && itemNames.length > 0
    ? itemNames.slice(0, 3).join(', ') + (itemNames.length > 3 ? ` +${itemNames.length - 3} more` : '')
    : `Order #${orderNumber}`;

  useEffect(() => {
    StatusBar.setBarStyle('light-content', true);

    // Haptic feedback
    Vibration.vibrate(100);

    // Play notification sound for all order status changes
    // Android: loads from res/raw/ by name (no extension, no basePath)
    // iOS: loads from main bundle with extension
    const fileName = Platform.OS === 'android' ? 'notification_sound' : 'notification_sound.wav';
    const basePath = Platform.OS === 'android' ? undefined : Sound.MAIN_BUNDLE;
    const sound = new Sound(fileName, basePath, (error) => {
      if (!error) {
        sound.setVolume(1.0);
        sound.play(() => sound.release());
      }
    });

    // Scale in
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // Icon bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -10, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Progress bar shrink (5s auto-dismiss)
    Animated.timing(progressAnim, { toValue: 0, duration: 5000, easing: Easing.linear, useNativeDriver: false }).start();

    const timer = setTimeout(stableDismiss, 5000);
    return () => {
      clearTimeout(timer);
      StatusBar.setBarStyle('default', true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.absoluteFill} pointerEvents="auto">
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: config.bgColors[0] }]}
        activeOpacity={1}
        onPress={stableDismiss}
      >
        {/* Pulsing rings */}
        <View style={styles.ringContainer}>
          <View style={[styles.ring, { width: 200, height: 200, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <View style={[styles.ring, { width: 260, height: 260, backgroundColor: 'rgba(255,255,255,0.05)' }]} />
        </View>

        <Animated.View style={[styles.content, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          {/* Icon */}
          <Animated.View style={[styles.iconCircle, { transform: [{ translateY: bounceAnim }] }]}>
            <Icon name={config.icon} size={56} color="#fff" />
          </Animated.View>

          {/* Food items as headline (or fallback to order number) */}
          <Text style={styles.headline} numberOfLines={2}>
            {headline}
          </Text>

          {/* Pickup token pill */}
          {pickupToken && (
            <View style={styles.tokenPill}>
              <Text style={styles.tokenPillLabel}>PICKUP</Text>
              <Text style={styles.tokenPillValue}>{pickupToken}</Text>
            </View>
          )}

          {/* Status label */}
          <Text style={styles.label}>{config.label}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Dismiss hint */}
          <Text style={styles.dismissHint}>Tap anywhere to dismiss</Text>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteFill: {
    ...StyleSheet.absoluteFillObject, zIndex: 9999, elevation: 9999,
  },
  overlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  ringContainer: {
    ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center',
  },
  ring: {
    position: 'absolute', borderRadius: 999,
  },
  content: { alignItems: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 112, height: 112, borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  headline: {
    fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center',
    maxWidth: 300, marginBottom: 12,
  },
  tokenPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, marginBottom: 16,
  },
  tokenPillLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5,
  },
  tokenPillValue: {
    fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 3,
  },
  label: {
    fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 12,
  },
  message: {
    fontSize: 15, color: 'rgba(255,255,255,0.9)', textAlign: 'center', maxWidth: 280, lineHeight: 22,
  },
  dismissHint: {
    fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500', marginTop: 40,
  },
  progressTrack: {
    width: 180, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 16, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
