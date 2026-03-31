import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
  ActivityIndicator, Animated, ScrollView, Keyboard, Platform,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import Icon from '../common/Icon';
import PaymentResultModal from '../common/PaymentResultModal';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchWalletBalance } from '../../store/slices/userSlice';
import walletService from '../../services/walletService';
import { resolveAvatarUrl } from '../../utils/imageUrl';

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
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ type: 'success' | 'failed'; amount: number } | null>(null);
  const pendingPaymentRef = useRef<{ razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } | null>(null);
  const isClosingRef = useRef(false);

  const slideAnim = useMemo(() => new Animated.Value(600), []);
  const backdropAnim = useMemo(() => new Animated.Value(0), []);
  const keyboardPadding = useMemo(() => new Animated.Value(0), []);

  // Smooth keyboard padding — replaces KeyboardAvoidingView to avoid abrupt reflow on Android
  useEffect(() => {
    if (!visible) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      if (isClosingRef.current) return;
      Animated.timing(keyboardPadding, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 150,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      if (isClosingRef.current) return;
      Animated.timing(keyboardPadding, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [visible, keyboardPadding]);

  useEffect(() => {
    if (visible) {
      // Reset closing guard and clear any leftover payment result
      isClosingRef.current = false;
      setPaymentResult(null);
      keyboardPadding.setValue(0);
      slideAnim.setValue(600);
      backdropAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  // Reset state when modal closes — use a small delay so it doesn't interfere with the exit animation
  useEffect(() => {
    if (!visible) {
      const resetTimer = setTimeout(() => {
        setAmount('');
        setError('');
        setVerificationFailed(false);
        pendingPaymentRef.current = null;
        isClosingRef.current = false;
      }, 300);
      return () => clearTimeout(resetTimer);
    }
  }, [visible]);

  const numericAmount = parseInt(amount || '0', 10);

  const handleChangeText = useCallback((t: string) => {
    // Strip non-digits, then strip leading zeros
    setAmount(t.replace(/[^0-9]/g, '').replace(/^0+/, ''));
    setError('');
  }, []);

  const handleTopUp = async () => {
    if (numericAmount < 10 || numericAmount > 5000) {
      setError('Amount must be between Rs. 10 and Rs. 5,000');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const orderData = await walletService.createRazorpayOrder(numericAmount);
      const options = {
        key: orderData.keyId,
        amount: orderData.amount * 100, // Use server amount, not local — prevents mismatch
        currency: orderData.currency || 'INR',
        name: 'CampusOne',
        description: `Wallet Top-up Rs. ${orderData.amount}`,
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: { color: '#10b981' },
        retry: { enabled: true, max_count: 3 },
        timeout: 300, // 5 minutes max for payment completion
      };
      const paymentResponse = await RazorpayCheckout.open(options);
      // Store payment response for potential retry
      pendingPaymentRef.current = {
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      };
      await walletService.verifyRazorpayPayment(pendingPaymentRef.current);
      pendingPaymentRef.current = null;
      setVerificationFailed(false);
      const paidAmount = numericAmount;
      dispatch(fetchWalletBalance());

      // Close TopUpModal, then show success result screen
      isClosingRef.current = true;
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(keyboardPadding, { toValue: 0, duration: 150, useNativeDriver: false }),
      ]).start(() => { setAmount(''); onClose(); });

      setPaymentResult({ type: 'success', amount: paidAmount });
    } catch (e: any) {
      // Razorpay SDK nests the error under e.error on some versions/platforms
      const rzpError = e?.error ?? e;
      const code: string = rzpError?.code ?? '';
      const reason: string = rzpError?.reason ?? '';
      const source: string = rzpError?.source ?? '';

      // Fire-and-forget: log failure details to backend for debugging
      walletService.logPaymentFailure({
        errorCode: code,
        errorReason: reason,
        errorSource: source,
        errorDescription: rzpError?.description ?? e?.message ?? '',
        amount: numericAmount,
        orderId: rzpError?.metadata?.order_id ?? '',
        method: rzpError?.metadata?.payment_method ?? '',
        phone: user?.phone ?? '',
      });

      const isCancelled =
        code === 'PAYMENT_CANCELLED' ||
        (code === 'BAD_REQUEST_ERROR' && reason === 'payment_error' && source === 'customer') ||
        rzpError?.description?.toLowerCase()?.includes('cancelled');

      const isRateLimited =
        e?.response?.status === 429 ||
        e?.response?.data?.error?.code === 'RATE_LIMIT_EXCEEDED';

      if (isCancelled) {
        pendingPaymentRef.current = null;
        setVerificationFailed(false);
        setError('Payment cancelled.');
      } else if (isRateLimited) {
        pendingPaymentRef.current = null;
        setVerificationFailed(false);
        setError('Too many payment attempts. Please wait a minute before trying again.');
      } else if (pendingPaymentRef.current) {
        // Payment succeeded at Razorpay but verification failed
        setVerificationFailed(true);
        setError('Payment was successful but verification failed. Tap "Retry Verification" to try again.');
      } else {
        // Hard failure — show full-screen failure result
        setPaymentResult({ type: 'failed', amount: numericAmount });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetryVerification = async () => {
    if (!pendingPaymentRef.current) return;
    setLoading(true);
    setError('');
    try {
      await walletService.verifyRazorpayPayment(pendingPaymentRef.current);
      pendingPaymentRef.current = null;
      setVerificationFailed(false);
      const paidAmount = numericAmount;
      dispatch(fetchWalletBalance());

      isClosingRef.current = true;
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(keyboardPadding, { toValue: 0, duration: 150, useNativeDriver: false }),
      ]).start(() => { setAmount(''); onClose(); });

      setPaymentResult({ type: 'success', amount: paidAmount });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Verification still failing. Please contact support if this persists.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Guard: prevent multiple concurrent close animations (back button / swipe spam)
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    Keyboard.dismiss();

    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(keyboardPadding, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start(() => {
      onClose();
    });
  };

  return (
    <>
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={handleClose}>
      {/* Animated backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={loading ? undefined : handleClose} accessibilityLabel="Close top up" accessibilityRole="button" />
      </Animated.View>

      <Animated.View
        style={[styles.kvWrapper, { paddingBottom: keyboardPadding }]}>
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
          <Text style={styles.inputLabel}>Enter Amount</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputPrefix}>Rs.</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={handleChangeText}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={5}
              autoCorrect={false}
              textAlign="center"
              accessibilityLabel="Top up amount"
            />
          </View>

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

          {/* Retry Verification Button */}
          {verificationFailed && pendingPaymentRef.current && (
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: '#dc2626', marginBottom: 8 }, loading && styles.submitBtnDisabled]}
              onPress={handleRetryVerification}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityLabel="Retry payment verification"
              accessibilityRole="button">
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Retry Verification</Text>
              )}
            </TouchableOpacity>
          )}

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
      </Animated.View>
    </Modal>

    {/* Payment Result (Success / Failed) */}
    <PaymentResultModal
      visible={!!paymentResult}
      type={paymentResult?.type || 'success'}
      amount={paymentResult?.amount || 0}
      userName={user?.name}
      userPhone={user?.phone}
      userAvatar={resolveAvatarUrl(user?.avatarUrl)}
      onContinue={() => setPaymentResult(null)}
      onRetry={() => {
        setPaymentResult(null);
        setError('');
      }}
    />
    </>
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
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 40,
    maxHeight: '95%',
  },

  handleBar: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: 8, paddingBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },

  balanceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', marginBottom: 20,
  },
  balanceIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  balanceLabel: { fontSize: 12, color: colors.textMuted },
  balanceValue: { fontSize: 22, fontWeight: '900', color: '#3b82f6' },

  inputLabel: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    backgroundColor: colors.surface, marginBottom: 14, paddingHorizontal: 16,
  },
  inputPrefix: { fontSize: 18, fontWeight: '600' as const, color: colors.textMuted, marginRight: 4 },
  input: {
    flex: 1, paddingVertical: 14, fontSize: 22, fontWeight: '700' as const,
    color: colors.text, textAlign: 'center' as const,
  },

  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center',
  },
  quickBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(16,185,129,0.1)' },
  quickBtnText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  quickBtnTextActive: { color: colors.primary },

  errorText: { fontSize: 12, color: colors.error, marginBottom: 10, textAlign: 'center' },

  submitBtn: {
    paddingVertical: 16, borderRadius: 18, backgroundColor: '#3b82f6', alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  helpText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
});
