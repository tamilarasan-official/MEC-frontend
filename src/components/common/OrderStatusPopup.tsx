import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing, Vibration,
} from 'react-native';
import Icon from './Icon';

interface OrderStatusPopupProps {
  status: 'preparing' | 'ready' | 'completed' | 'cancelled';
  orderNumber: string;
  onDismiss: () => void;
}

const statusConfig = {
  preparing: {
    icon: 'restaurant-outline',
    label: 'Preparing Your Order',
    message: 'Your order has been confirmed and is being prepared!',
    bgColors: ['#f59e0b', '#eab308'],
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

export function OrderStatusPopup({ status, orderNumber, onDismiss }: OrderStatusPopupProps) {
  const config = statusConfig[status];
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Haptic feedback
    Vibration.vibrate(100);

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

    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: config.bgColors[0] }]}
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

          {/* Order number */}
          <Text style={styles.orderNumber}>Order #{orderNumber}</Text>

          {/* Status label */}
          <Text style={styles.label}>{config.label}</Text>

          {/* Message */}
          <Text style={styles.message}>{config.message}</Text>

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
