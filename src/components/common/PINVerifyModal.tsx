import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated,
  ActivityIndicator, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import Icon from './Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { mediumHaptic, errorHaptic } from '../../utils/haptics';
import api from '../../services/api';
import { useSecureScreen } from '../../utils/useSecureScreen';

const PIN_LENGTH = 4;
const { width: SW } = Dimensions.get('window');

interface PINVerifyModalProps {
  visible: boolean;
  amount: number;
  title: string;
  onVerified: () => void;
  onCancel: () => void;
}

export default function PINVerifyModal({
  visible, amount, title, onVerified, onCancel,
}: PINVerifyModalProps) {
  useSecureScreen();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Reset state on each open
  useEffect(() => {
    if (visible) {
      setPin('');
      setError(null);
      setLoading(false);
      setLocked(false);
      setLockCountdown(0);
      // Animate in
      slideAnim.setValue(300);
      backdropAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0, friction: 9, tension: 65, useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1, duration: 250, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockCountdown <= 0) {
      if (locked) setLocked(false);
      return;
    }
    const interval = setInterval(() => {
      setLockCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockCountdown, locked]);

  const triggerShake = useCallback(() => {
    errorHaptic();
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 300, duration: 200, useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }),
    ]).start(() => onCancel());
  }, [slideAnim, backdropAnim, onCancel]);

  const verifyPin = useCallback(async (finalPin: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/verify-pin', { pin: finalPin });
      onVerified();
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.error?.code;
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || 'Wrong PIN. Please try again.';

      if (status === 429 || code === 'PIN_LOCKED' || code === 'PIN_COOLDOWN') {
        // Parse seconds from "PIN locked. Try again in 27 seconds."
        const secMatch = msg.match(/(\d+)\s*second/);
        const seconds = secMatch ? parseInt(secMatch[1], 10) : 30;
        setLocked(true);
        setLockCountdown(seconds);
        setError(null);
      } else {
        setError(msg);
        triggerShake();
      }
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [onVerified, triggerShake]);

  const handleDigitPress = useCallback((digit: string) => {
    if (loading || locked) return;
    if (pin.length >= PIN_LENGTH) return;

    mediumHaptic();
    const newPin = pin + digit;
    setPin(newPin);
    setError(null);

    if (newPin.length === PIN_LENGTH) {
      setTimeout(() => verifyPin(newPin), 200);
    }
  }, [pin, loading, locked, verifyPin]);

  const handleBackspace = useCallback(() => {
    if (loading || locked) return;
    if (pin.length === 0) return;
    mediumHaptic();
    setPin(prev => prev.slice(0, -1));
    setError(null);
  }, [pin, loading, locked]);

  const formatCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderPinIndicators = () => (
    <Animated.View style={[styles.pinRow, { transform: [{ translateX: shakeAnim }] }]}>
      {Array.from({ length: PIN_LENGTH }, (_, i) => (
        <View
          key={i}
          style={[
            styles.pinCircle,
            i < pin.length && styles.pinCircleFilled,
            error ? styles.pinCircleError : null,
          ]}
        />
      ))}
    </Animated.View>
  );

  const renderKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'backspace'],
    ];

    return (
      <View style={styles.keypad}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key, colIndex) => {
              if (key === '') {
                return <View key={colIndex} style={styles.keypadKey} />;
              }
              if (key === 'backspace') {
                return (
                  <TouchableOpacity
                    key={colIndex}
                    style={styles.keypadKey}
                    onPress={handleBackspace}
                    activeOpacity={0.6}
                    accessibilityLabel="Delete"
                    accessibilityRole="button"
                  >
                    <Icon name="backspace-outline" size={26} color={colors.foreground} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={colIndex}
                  style={styles.keypadKey}
                  onPress={() => handleDigitPress(key)}
                  activeOpacity={0.6}
                  accessibilityLabel={`Digit ${key}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.keypadDigit}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
      </TouchableWithoutFeedback>

      {/* Bottom sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconCircle}>
            <Icon name="lock-closed" size={22} color={colors.accent} />
          </View>
          <Text style={styles.headerTitle}>Enter Transaction PIN</Text>
        </View>

        {/* Transaction info */}
        <View style={styles.txnInfo}>
          <Text style={styles.txnTitle}>{title}</Text>
          <Text style={styles.txnAmount}>Rs. {amount}</Text>
        </View>

        {/* PIN indicators */}
        {renderPinIndicators()}

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Locked message */}
        {locked && (
          <View style={styles.lockedBox}>
            <Icon name="time-outline" size={18} color={colors.warning} />
            <Text style={styles.lockedText}>
              Too many attempts. Try again in {formatCountdown(lockCountdown)}
            </Text>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Verifying...</Text>
          </View>
        )}

        {/* Keypad */}
        {renderKeypad()}
      </Animated.View>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: c.border,
    borderBottomWidth: 0,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: c.foreground,
  },

  // Transaction info
  txnInfo: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: c.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  txnTitle: {
    fontSize: 14,
    color: c.mutedForeground,
    marginBottom: 4,
  },
  txnAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: c.foreground,
  },

  // PIN indicators
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  pinCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: c.border,
    backgroundColor: 'transparent',
  },
  pinCircleFilled: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  pinCircleError: {
    borderColor: '#ef4444',
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },

  // Locked
  lockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  lockedText: {
    color: c.warning,
    fontSize: 13,
    fontWeight: '600',
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: c.mutedForeground,
  },

  // Keypad
  keypad: {
    paddingBottom: 4,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  keypadKey: {
    width: (SW - 48) / 3,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  keypadDigit: {
    fontSize: 26,
    fontWeight: '600',
    color: c.foreground,
  },

});
