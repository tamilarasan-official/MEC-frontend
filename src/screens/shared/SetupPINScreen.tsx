import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ActivityIndicator, Dimensions, StatusBar,
} from 'react-native';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { mediumHaptic, successHaptic } from '../../utils/haptics';
import api from '../../services/api';
import { useSecureScreen } from '../../utils/useSecureScreen';

const PIN_LENGTH = 4;
const { width: SW } = Dimensions.get('window');

interface SetupPINScreenProps {
  onComplete: () => void;
}

export default function SetupPINScreen({ onComplete }: SetupPINScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useSecureScreen();
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleDigitPress = useCallback((digit: string) => {
    if (loading || pin.length >= PIN_LENGTH) return;
    mediumHaptic();
    const newPin = pin + digit;
    setPin(newPin);
    setError(null);

    if (newPin.length === PIN_LENGTH) {
      if (step === 'enter') {
        setTimeout(() => {
          setFirstPin(newPin);
          setPin('');
          setStep('confirm');
        }, 200);
      } else {
        if (newPin !== firstPin) {
          setTimeout(() => {
            triggerShake();
            setError("PINs don't match. Try again.");
            setPin('');
            setStep('enter');
            setFirstPin('');
          }, 200);
        } else {
          setTimeout(() => submitPin(newPin), 200);
        }
      }
    }
  }, [pin, step, firstPin, loading, triggerShake]);

  const handleBackspace = useCallback(() => {
    if (loading || pin.length === 0) return;
    mediumHaptic();
    setPin(prev => prev.slice(0, -1));
    setError(null);
  }, [pin, loading]);

  const submitPin = useCallback(async (finalPin: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/setup-pin', { pin: finalPin });
      successHaptic();
      setLoading(false);
      onComplete();
      return;
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || 'Failed to set up PIN';
      setError(msg);
      setPin('');
      setStep('enter');
      setFirstPin('');
      triggerShake();
    } finally {
      setLoading(false);
    }
  }, [onComplete, triggerShake]);

  const keys = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'back']];

  return (
    <View style={styles.overlay}>
      <StatusBar barStyle="light-content" />

      {/* Top section */}
      <View style={styles.topSection}>
        <View style={styles.iconCircle}>
          <Icon name="lock-closed" size={28} color="#fff" />
        </View>
        <Text style={styles.title}>Set Up Transaction PIN</Text>
        <Text style={styles.subtitle}>Secure your wallet with a 4-digit PIN</Text>
      </View>

      {/* Middle section */}
      <View style={styles.midSection}>
        <Text style={styles.stepText}>
          {step === 'enter' ? 'Enter a 4-digit PIN' : 'Confirm your PIN'}
        </Text>

        <Animated.View style={[styles.pinRow, { transform: [{ translateX: shakeAnim }] }]}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled]} />
          ))}
        </Animated.View>

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.loadingText}>Setting up PIN...</Text>
          </View>
        )}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {keys.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((k, ci) => {
              if (k === '') return <View key={ci} style={styles.keyCell} />;
              if (k === 'back') return (
                <TouchableOpacity key={ci} style={styles.keyCell} onPress={handleBackspace} activeOpacity={0.6}>
                  <Icon name="backspace-outline" size={24} color="#fff" />
                </TouchableOpacity>
              );
              return (
                <TouchableOpacity key={ci} style={styles.keyCell} onPress={() => handleDigitPress(k)} activeOpacity={0.6}>
                  <Text style={styles.keyText}>{k}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (_c: ThemeColors) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    backgroundColor: '#8b5cf6',
    justifyContent: 'space-between',
  },

  topSection: {
    alignItems: 'center',
    paddingTop: 80,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: '#fff',
    textAlign: 'center', marginBottom: 6,
  },
  subtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center',
  },

  midSection: {
    alignItems: 'center', paddingHorizontal: 32,
  },
  stepText: {
    fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.85)',
    marginBottom: 20,
  },
  pinRow: {
    flexDirection: 'row', justifyContent: 'center',
    marginBottom: 16,
  },
  pinDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'transparent',
    marginHorizontal: 10,
  },
  pinDotFilled: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  errorText: {
    color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, overflow: 'hidden',
  },
  loadingRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 8,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.8)', fontSize: 13, marginLeft: 8,
  },

  keypad: {
    paddingBottom: 40, paddingHorizontal: 16,
  },
  keyRow: {
    flexDirection: 'row', justifyContent: 'center',
  },
  keyCell: {
    width: SW / 3 - 20, height: 56,
    justifyContent: 'center', alignItems: 'center',
  },
  keyText: {
    fontSize: 26, fontWeight: '600', color: '#fff',
  },
});
