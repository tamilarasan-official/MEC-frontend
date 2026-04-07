/**
 * MaintenanceScreen
 * Full-screen overlay shown when the app is in maintenance mode.
 * Purple-themed, non-dismissible. Auto-retries to detect when maintenance ends.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { MaintenanceInfo } from '../../services/maintenanceService';

interface Props {
  info: MaintenanceInfo;
  onRetry: () => void;
}

const RETRY_INTERVAL_MS = 30000; // Auto-retry every 30 seconds

export default function MaintenanceScreen({ info, onRetry }: Props) {
  const [retrying, setRetrying] = useState(false);

  // Animations
  const iconScale = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const msgOpacity = useRef(new Animated.Value(0)).current;
  const timeOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    StatusBar.setBarStyle('light-content');

    // Staggered entrance
    Animated.stagger(180, [
      Animated.spring(iconScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(msgOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(timeOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(btnOpacity, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();

    // Pulsing icon ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      StatusBar.setBarStyle('default');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-retry polling
  useEffect(() => {
    const interval = setInterval(() => {
      onRetry();
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [onRetry]);

  const handleRetry = useCallback(() => {
    setRetrying(true);
    onRetry();
    // Reset retrying state after a delay (onRetry is async but we don't await it here)
    setTimeout(() => setRetrying(false), 3000);
  }, [onRetry]);

  // Compute estimated time remaining
  const getTimeText = () => {
    const dur = info.estimatedDuration || 1;
    if (info.startedAt) {
      const started = new Date(info.startedAt).getTime();
      const endEstimate = started + dur * 60 * 60 * 1000;
      const remaining = endEstimate - Date.now();
      if (remaining > 0) {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `Estimated ${hours}h ${minutes}m remaining`;
        return `Estimated ${minutes} minutes remaining`;
      }
      return 'Should be back very soon';
    }
    return `Will be back in ~${dur} hour${dur > 1 ? 's' : ''}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7c3aed" />

      {/* Pulsing ring behind icon */}
      <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />

      {/* Icon */}
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
        <View style={styles.iconOuter}>
          <View style={styles.iconInner}>
            <Text style={styles.iconEmoji}>🔧</Text>
          </View>
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.Text
        style={[
          styles.title,
          {
            opacity: titleOpacity,
            transform: [{ translateY: titleOpacity.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}
      >
        Under Maintenance
      </Animated.Text>

      {/* Message */}
      <Animated.Text
        style={[
          styles.message,
          {
            opacity: msgOpacity,
            transform: [{ translateY: msgOpacity.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }],
          },
        ]}
      >
        {info.message}
      </Animated.Text>

      {/* Time estimate */}
      <Animated.View
        style={[
          styles.timeBadge,
          {
            opacity: timeOpacity,
            transform: [{ translateY: timeOpacity.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }],
          },
        ]}
      >
        <Text style={styles.timeIcon}>⏱</Text>
        <Text style={styles.timeText}>{getTimeText()}</Text>
      </Animated.View>

      {/* Retry button */}
      <Animated.View style={{ opacity: btnOpacity, transform: [{ scale: btnOpacity }] }}>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={handleRetry}
          disabled={retrying}
          activeOpacity={0.8}
        >
          {retrying ? (
            <ActivityIndicator size="small" color="#7c3aed" />
          ) : (
            <Text style={styles.retryText}>Check Again</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Auto-retry hint */}
      <Animated.Text style={[styles.hint, { opacity: btnOpacity }]}>
        Auto-checking every 30 seconds
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconWrap: {
    marginBottom: 28,
  },
  iconOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 36,
    gap: 8,
  },
  timeIcon: {
    fontSize: 18,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  retryBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 20,
    minWidth: 160,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7c3aed',
    letterSpacing: 0.5,
  },
  hint: {
    marginTop: 16,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
});
