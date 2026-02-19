import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
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

  const numericAmount = parseInt(amount || '0', 10);

  const handleTopUp = async () => {
    if (numericAmount < 1 || numericAmount > 50000) {
      setError('Amount must be between Rs. 1 and Rs. 50,000');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // 1. Create Razorpay order on backend
      const orderData = await walletService.createRazorpayOrder(numericAmount);

      // 2. Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: numericAmount * 100, // in paise
        currency: orderData.currency || 'INR',
        name: 'MadrasOne',
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

      // 3. Verify payment on backend
      await walletService.verifyRazorpayPayment({
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      });

      // 4. Success
      setSuccess(true);
      dispatch(fetchWalletBalance());
      setTimeout(() => {
        setSuccess(false);
        setAmount('');
        onClose();
      }, 2000);
    } catch (e: any) {
      // Razorpay checkout dismissed by user
      if (e?.code === 'PAYMENT_CANCELLED') {
        setError('Payment cancelled');
      } else {
        setError(e?.response?.data?.message || e?.description || 'Payment failed. Please try again.');
      }
    }
    setLoading(false);
  };

  const handleClose = () => {
    setAmount('');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Top Up Wallet</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Icon name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Current Balance */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceIcon}>
                <Icon name="wallet" size={20} color={colors.blue[500]} />
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
            />

            {/* Quick amounts */}
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.quickBtn, amount === String(a) && styles.quickBtnActive]}
                  onPress={() => { setAmount(String(a)); setError(''); }}
                  activeOpacity={0.7}>
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
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Pay Rs. {numericAmount || 0}</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.helpText}>Secure payment via Razorpay. Or visit the college office for cash deposits.</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: {
    flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: colors.background,
    borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  balanceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', marginBottom: 20,
  },
  balanceIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  balanceLabel: { fontSize: 12, color: colors.textMuted },
  balanceValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  inputLabel: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '600',
    color: colors.text, backgroundColor: colors.surface, marginBottom: 14,
  },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quickBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center',
  },
  quickBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(16,185,129,0.1)' },
  quickBtnText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  quickBtnTextActive: { color: colors.primary },
  errorText: { fontSize: 12, color: colors.error, marginBottom: 8, textAlign: 'center' },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.1)', marginBottom: 12,
  },
  successText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  submitBtn: {
    paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  helpText: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
