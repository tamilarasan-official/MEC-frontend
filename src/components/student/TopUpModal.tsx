import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Animated, ScrollView, Keyboard,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchWalletBalance } from '../../store/slices/userSlice';
import walletService from '../../services/walletService';

interface TopUpModalProps {
  visible: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS = [50, 100, 200, 500];

export default function TopUpModal({ visible, onClose }: TopUpModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { return () => { if (successTimerRef.current !== null) clearTimeout(successTimerRef.current); }; }, []);

  const slideAnim = useMemo(() => new Animated.Value(600), []);

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(600);
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }).start();
    }
  }, [visible, slideAnim]);

  const numericAmount = parseInt(amount || '0', 10);

  const handleTopUp = async () => {
    if (numericAmount < 1 || numericAmount > 50000) {
      setError('Amount must be between Rs. 1 and Rs. 50,000');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const orderData = await walletService.createRazorpayOrder(numericAmount);
      const options = {
        key: orderData.keyId,
        amount: numericAmount * 100,
        currency: orderData.currency || 'INR',
        name: 'CampusOne',
        description: `Wallet Top-up Rs. ${numericAmount}`,
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: { color: '#10b981' },
      };
      const paymentResponse = await RazorpayCheckout.open(options);
      await walletService.verifyRazorpayPayment({
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      });
      setSuccess(true);
      dispatch(fetchWalletBalance());
      successTimerRef.current = setTimeout(() => {
        setSuccess(false);
        setAmount('');
        onClose();
      }, 2000);
    } catch (e: any) {
      if (e?.code === 'PAYMENT_CANCELLED' || e?.description?.toLowerCase()?.includes('cancelled')) {
        setError('Payment cancelled.');
      } else if (e?.code === 'BAD_REQUEST_ERROR' || e?.description?.toLowerCase()?.includes('gateway')) {
        setError('Payment gateway is currently unavailable. Please try again later.');
      } else if (e?.code === 'NETWORK_ERROR' || e?.message?.toLowerCase()?.includes('network')) {
        setError('Network error. Please check your connection and try again.');
      } else if (e?.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(e?.response?.data?.message || e?.description || 'Payment failed. Please try again.');
      }
    }
    setLoading(false);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setAmount('');
      setError('');
      setSuccess(false);
      onClose();
    });
  };

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={handleClose}>
      {/* Backdrop tap to dismiss */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} accessibilityLabel="Close top up" accessibilityRole="button" />

      <KeyboardAvoidingView
        style={styles.kvWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
          {/* Drag handle */}
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Top Up Wallet</Text>
              <Text style={styles.subtitle}>Add money to your balance</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7} accessibilityLabel="Close top up" accessibilityRole="button">
              <Icon name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Current Balance */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceIcon}>
              <Icon name="wallet" size={20} color="#3b82f6" />
            </View>
            <View>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceValue}>Rs. {user?.balance || 0}</Text>
            </View>
          </View>

          {/* Amount Input */}
          <Text style={styles.inputLabel}>Enter Amount (Rs.)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={(t) => { setAmount(t.replace(/[^0-9]/g, '')); setError(''); }}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={5}
            accessibilityLabel="Top up amount"
          />

          {/* Quick amounts */}
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map(a => (
              <TouchableOpacity
                key={a}
                style={[styles.quickBtn, amount === String(a) && styles.quickBtnActive]}
                onPress={() => { setAmount(String(a)); setError(''); }}
                activeOpacity={0.7}
                accessibilityLabel={`Select rupees ${a}`}
                accessibilityRole="button">
                <Text style={[styles.quickBtnText, amount === String(a) && styles.quickBtnTextActive]}>
                  Rs. {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Success */}
          {success ? (
            <View style={styles.successBanner}>
              <Icon name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={styles.successText}>Payment initiated!</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (loading || numericAmount < 1) && styles.submitBtnDisabled]}
            onPress={handleTopUp}
            disabled={loading || numericAmount < 1}
            activeOpacity={0.85}
            accessibilityLabel={numericAmount > 0 ? `Pay rupees ${numericAmount}` : 'Enter amount'}
            accessibilityRole="button">
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitText}>
                {numericAmount > 0 ? `Pay Rs. ${numericAmount}` : 'Enter Amount'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.helpText}>Or visit the college office for cash deposits.</Text>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  kvWrapper: {
    flex: 1, justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36,
    maxHeight: '85%',
  },

  handleBar: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: 8, paddingBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },

  balanceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', marginBottom: 20,
  },
  balanceIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  balanceLabel: { fontSize: 12, color: colors.textMuted },
  balanceValue: { fontSize: 20, fontWeight: '800', color: '#3b82f6' },

  inputLabel: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, fontWeight: '600',
    color: colors.text, backgroundColor: colors.surface, marginBottom: 14,
  },

  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  quickBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center',
  },
  quickBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(16,185,129,0.1)' },
  quickBtnText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  quickBtnTextActive: { color: colors.primary },

  errorText: { fontSize: 12, color: colors.error, marginBottom: 10, textAlign: 'center' },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.1)', marginBottom: 12,
  },
  successText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  submitBtn: {
    paddingVertical: 16, borderRadius: 16, backgroundColor: '#1e3a5f', alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  helpText: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
