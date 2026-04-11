import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Keyboard, Platform,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import Icon from '../common/Icon';
import PaymentResultModal from '../common/PaymentResultModal';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchWalletBalance, fetchTransactions } from '../../store/slices/userSlice';
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
  const walletBalance = useAppSelector(s => s.user.balance);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState('');
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ type: 'success' | 'failed'; amount: number } | null>(null);
  const pendingPaymentRef = useRef<{ razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } | null>(null);

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['55%', '90%'], []);

  useEffect(() => {
    if (visible) {
      setPaymentResult(null);
      bottomSheetRef.current?.present();
    }
  }, [visible]);

  // Snap to full height when keyboard appears so input stays visible
  useEffect(() => {
    if (!visible) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      bottomSheetRef.current?.snapToIndex(1);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      bottomSheetRef.current?.snapToIndex(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [visible]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      const resetTimer = setTimeout(() => {
        setAmount('');
        setError('');
        setVerificationFailed(false);
        pendingPaymentRef.current = null;
        submittingRef.current = false;
      }, 300);
      return () => clearTimeout(resetTimer);
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (loading) return;
    Keyboard.dismiss();
    bottomSheetRef.current?.dismiss();
  }, [loading]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior={loading ? 'none' : 'close'}
      />
    ),
    [loading],
  );

  const numericAmount = parseInt(amount || '0', 10);

  const handleChangeText = useCallback((t: string) => {
    setAmount(t.replace(/[^0-9]/g, ''));
    setError('');
  }, []);

  const handleAmountFocus = useCallback(() => {
    bottomSheetRef.current?.snapToIndex(1);
  }, []);

  const handleTopUp = async () => {
    if (submittingRef.current) return;
    if (numericAmount < 1 || numericAmount > 50000) {
      Keyboard.dismiss();
      setError('Amount must be between Rs. 1 and Rs. 50,000');
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const orderData = await walletService.createRazorpayOrder(numericAmount);
      const amountPaise = orderData.amount > 1000 ? orderData.amount : orderData.amount * 100;
      const options = {
        key: orderData.keyId,
        amount: amountPaise,
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
        timeout: 300,
      };
      const paymentResponse = await RazorpayCheckout.open(options);
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
      dispatch(fetchTransactions());

      Keyboard.dismiss();
      setAmount('');
      bottomSheetRef.current?.dismiss();
      setPaymentResult({ type: 'success', amount: paidAmount });
    } catch (e: any) {
      const rzpError = e?.error ?? e;
      const code: string = rzpError?.code ?? '';
      const reason: string = rzpError?.reason ?? '';
      const source: string = rzpError?.source ?? '';

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
        setVerificationFailed(true);
        setError('Payment was successful but verification failed. Tap "Retry Verification" to try again.');
      } else {
        setPaymentResult({ type: 'failed', amount: numericAmount });
      }
    } finally {
      setLoading(false);
      submittingRef.current = false;
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

      Keyboard.dismiss();
      setAmount('');
      bottomSheetRef.current?.dismiss();
      setPaymentResult({ type: 'success', amount: paidAmount });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Verification still failing. Please contact support if this persists.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      enablePanDownToClose={!loading}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 36 }}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
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
            <Text style={styles.balanceValue}>Rs. {walletBalance ?? 0}</Text>
          </View>
        </View>

        {/* Amount Input */}
        <Text style={styles.inputLabel}>Enter Amount (Rs.)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={handleChangeText}
          onFocus={handleAmountFocus}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={5}
          autoCorrect={false}
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
      </BottomSheetScrollView>
    </BottomSheetModal>

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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: 8, paddingBottom: 24,
  },
  title: { fontSize: 22, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },

  balanceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', marginBottom: 20,
  },
  balanceIcon: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  balanceLabel: { fontSize: 12, color: colors.textMuted },
  balanceValue: { fontSize: 22, fontWeight: '900', color: '#3b82f6' },

  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 16, fontSize: 22, fontWeight: '700',
    color: colors.text, backgroundColor: colors.surface, marginBottom: 14,
  },

  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  quickBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center',
  },
  quickBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(16,185,129,0.1)' },
  quickBtnText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  quickBtnTextActive: { color: colors.primary },

  errorText: { fontSize: 12, color: colors.error, marginBottom: 10, textAlign: 'center' },

  submitBtn: {
    paddingVertical: 17, borderRadius: 18, backgroundColor: '#3b82f6', alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  helpText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
});
