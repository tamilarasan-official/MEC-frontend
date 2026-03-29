import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Vibration, StatusBar,
} from 'react-native';
import Sound from 'react-native-sound';
import Icon from './Icon';

// Enable playback in silent mode (iOS)
Sound.setCategory('Playback');

interface OrderStatusPopupProps {
  status: 'preparing' | 'partially_ready' | 'ready' | 'completed' | 'cancelled';
  orderNumber: string;
  pickupToken?: string;
  itemNames?: string[];
  onDismiss: () => void;
}

const statusConfig = {
  preparing: {
    icon: 'restaurant-outline',
    label: 'Preparing Your Order',
    bgColors: ['#f59e0b', '#eab308'],
  },
  partially_ready: {
    icon: 'hourglass-outline',
    label: 'Items Partially Ready!',
    bgColors: ['#8b5cf6', '#7c3aed'],
  },
  ready: {
    icon: 'cube-outline',
    label: 'Ready for Pickup!',
    bgColors: ['#f97316', '#ea580c'],
  },
  completed: {
    icon: 'checkmark-circle',
    label: 'Order Delivered',
    bgColors: ['#22c55e', '#16a34a'],
  },
  cancelled: {
    icon: 'close-circle',
    label: 'Order Cancelled',
    bgColors: ['#ef4444', '#dc2626'],
  },
};

const dynamicMessage = (status: string, itemNames?: string[]): string => {
  const names = itemNames?.slice(0, 3).join(', ') || 'Your order';
  const suffix = itemNames && itemNames.length > 3 ? ` +${itemNames.length - 3} more` : '';
  switch (status) {
    case 'preparing': return `Your ${names}${suffix} is being prepared!`;
    case 'partially_ready': return `Some items from your order are ready for pickup!`;
    case 'ready': return `Head to the counter now to collect your order!`;
    case 'completed': return `Your order has been delivered. Enjoy your meal!`;
    case 'cancelled': return `Your order has been cancelled. Amount refunded to wallet.`;
    default: return 'Your order has been updated.';
  }
};

export function OrderStatusPopup({ status, orderNumber, pickupToken, itemNames, onDismiss }: OrderStatusPopupProps) {
  const config = statusConfig[status];
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Show food item names as headline (or fall back to order number)
  const headline = itemNames && itemNames.length > 0
    ? itemNames.slice(0, 3).join(', ') + (itemNames.length > 3 ? ` +${itemNames.length - 3} more` : '')
    : `Order #${orderNumber}`;

  useEffect(() => {
    StatusBar.setBarStyle('light-content');

    // Haptic feedback
    Vibration.vibrate(100);

    // Play notification sound
    const sound = new Sound('notification_sound.wav', Sound.MAIN_BUNDLE, (error) => {
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
    Animated.timing(progressAnim, { toValue: 0, duration: 3000, easing: Easing.linear, useNativeDriver: false }).start();

    const timer = setTimeout(onDismiss, 3000);
    return () => {
      clearTimeout(timer);
      StatusBar.setBarStyle('default');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.overlay, { backgroundColor: config.bgColors[0] }]} pointerEvents="box-none">
      <TouchableOpacity
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}
        activeOpacity={1}
        onPress={onDismiss}
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

          {/* Food item names as headline */}
          <Text style={styles.headline} numberOfLines={2}>{headline}</Text>

          {/* Pickup token pill */}
          {pickupToken && (
            <View style={styles.tokenPill}>
              <Text style={styles.tokenLabel}>PICKUP</Text>
              <Text style={styles.tokenValue}>{pickupToken}</Text>
            </View>
          )}

          {/* Status label */}
          <Text style={styles.label}>{config.label}</Text>

          {/* Dynamic message */}
          <Text style={styles.message}>{dynamicMessage(status, itemNames)}</Text>

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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
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
  tokenLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5,
  },
  tokenValue: {
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
