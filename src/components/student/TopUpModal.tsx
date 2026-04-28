import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Keyboard,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import RazorpayCheckout from 'react-native-razorpay';
import Icon from '../common/Icon';
import PaymentResultModal from '../common/PaymentResultModal';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchWalletBalance } from '../../store/slices/userSlice';
import walletService from '../../services/walletService';
import api from '../../services/api';
import { resolveAvatarUrl } from '../../utils/imageUrl';

interface TopUpModalProps {
  visible: boolean;
  onClose: () => void;
}

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
  const [minRecharge, setMinRecharge] = useState(0);
  const pendingPaymentRef = useRef<{ razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } | null>(null);

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['55%', '90%'], []);
  const pendingActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (visible) {
      setPaymentResult(null);
      bottomSheetRef.current?.present();
    }
  }, [visible]);

  // Fetch minimum recharge amount set by accountant
  useEffect(() => {
    if (!visible) return;
    api.get('/student/wallet/config')
      .then(res => setMinRecharge(res.data?.data?.minRechargeAmount || 0))
      .catch(() => setMinRecharge(0));
  }, [visible]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      const resetTimer = setTimeout(() => {
        setAmount('');
        setError('');
        setVerificationFailed(false);
        pendingPaymentRef.current = null;
      }, 300);
      return () => clearTimeout(resetTimer);
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    onClose();
    if (pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      action();
    }
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
    setAmount(t.replace(/[^0-9]/g, '').replace(/^0+/, ''));
    setError('');
  }, []);

  const dismissAndShowResult = useCallback((result: { type: 'success' | 'failed'; amount: number }) => {
    Keyboard.dismiss();
    setPaymentResult(result);
    pendingActionRef.current = null;
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleTopUp = async () => {
    const effectiveMin = minRecharge > 0 ? minRecharge : 10;
    if (numericAmount < effectiveMin) {
      setError(`Minimum recharge amount is Rs. ${effectiveMin}`);
      return;
    }
    if (numericAmount > 5000) {
      setError('Amount must be Rs. 5,000 or less');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const orderData = await walletService.createRazorpayOrder(numericAmount);
      const options = {
        key: orderData.keyId,
        amount: orderData.amount * 100,
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
      setAmount('');
      dismissAndShowResult({ type: 'success', amount: paidAmount });
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
        dismissAndShowResult({ type: 'failed', amount: numericAmount });
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
      setAmount('');
      dismissAndShowResult({ type: 'success', amount: paidAmount });
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
      enablePanDownToClose={!loading}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollContent}
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
            onFocus={() => bottomSheetRef.current?.snapToIndex(1)}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={5}
            autoCorrect={false}
            accessibilityLabel="Top up amount"
          />
        </View>

        {/* Minimum recharge hint */}
        {minRecharge > 0 && (
          <Text style={styles.minHint}>Minimum recharge amount is Rs. {minRecharge}</Text>
        )}

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
          style={[styles.submitBtn, (loading || numericAmount < (minRecharge > 0 ? minRecharge : 1)) && styles.submitBtnDisabled]}
          onPress={handleTopUp}
          disabled={loading || numericAmount < (minRecharge > 0 ? minRecharge : 1)}
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
  sheetBackground: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: 4, paddingBottom: 20,
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
    flexDirection: 'row' as const, alignItems: 'center' as const,
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    backgroundColor: colors.surface, marginBottom: 14, paddingHorizontal: 16,
  },
  inputPrefix: { fontSize: 18, fontWeight: '600' as const, color: colors.textMuted, marginRight: 4 },
  input: {
    flex: 1, paddingVertical: 14, fontSize: 22, fontWeight: '700' as const,
    color: colors.text,
  },

  minHint: {
    fontSize: 12, fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 14, marginTop: 4,
  },

  errorText: { fontSize: 12, color: colors.error, marginBottom: 10, textAlign: 'center' },

  submitBtn: {
    paddingVertical: 16, borderRadius: 18, backgroundColor: '#3b82f6', alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  helpText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
});
