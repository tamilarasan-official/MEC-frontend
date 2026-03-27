import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing, Vibration, Platform,
} from 'react-native';
import Sound from 'react-native-sound';
import Icon from './Icon';

// Enable playback in silent mode (iOS)
Sound.setCategory('Playback');

interface OrderStatusPopupProps {
  status: 'preparing' | 'partially_ready' | 'ready' | 'partially_delivered' | 'completed' | 'cancelled';
  orderNumber: string;
  itemNames?: string[];
  onDismiss: () => void;
}

const statusConfig: Record<string, { icon: string; label: string; message: string; bgColors: string[] }> = {
  preparing: {
    icon: 'restaurant-outline',
    label: 'Preparing Your Order',
    message: 'Your order has been confirmed and is being prepared!',
    bgColors: ['#f59e0b', '#eab308'],
  },
  partially_ready: {
    icon: 'git-branch-outline',
    label: 'Item Ready for Pickup!',
    message: 'Some items from your order are ready. Head to the counter to collect them!',
    bgColors: ['#8b5cf6', '#7c3aed'],
  },
  partially_delivered: {
    icon: 'cube-outline',
    label: 'Partial Pickup Done',
    message: 'Some items have been handed over. Remaining items will be ready soon!',
    bgColors: ['#3b82f6', '#2563eb'],
  },
  ready: {
    icon: 'cube-outline',
    label: 'Ready for Pickup!',
    message: 'Head to the counter now to collect your order!',
    bgColors: ['#f97316', '#ea580c'],
  },
  completed: {
    icon: 'checkmark-circle',
    label: 'Order Delivered',
    message: 'Your order has been delivered. Enjoy your meal!',
    bgColors: ['#22c55e', '#16a34a'],
  },
  cancelled: {
    icon: 'close-circle',
    label: 'Order Cancelled',
    message: 'Your order has been cancelled. The amount will be refunded to your wallet.',
    bgColors: ['#ef4444', '#dc2626'],
  },
};

export function OrderStatusPopup({ status, orderNumber, itemNames, onDismiss }: OrderStatusPopupProps) {
  const config = statusConfig[status] || statusConfig.preparing;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const stableDismiss = useCallback(() => onDismissRef.current(), []);
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
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
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={stableDismiss}>
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

          {/* Order number */}
          <Text style={styles.orderNumber}>Order #{orderNumber}</Text>

          {/* Status label */}
          <Text style={styles.label}>{config.label}</Text>

          {/* Message */}
          <Text style={styles.message}>{config.message}</Text>

          {/* Item names for partial delivery */}
          {itemNames && itemNames.length > 0 && (
            <Text style={styles.itemNames}>{itemNames.join(', ')}</Text>
          )}

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
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 32,
  },
  orderNumber: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8,
  },
  label: {
    fontSize: 32, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 16,
  },
  message: {
    fontSize: 16, color: 'rgba(255,255,255,0.9)', textAlign: 'center', maxWidth: 280, lineHeight: 22,
  },
  itemNames: {
    fontSize: 15, fontWeight: '700', color: '#fff', textAlign: 'center', marginTop: 12,
    maxWidth: 280, lineHeight: 22,
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
