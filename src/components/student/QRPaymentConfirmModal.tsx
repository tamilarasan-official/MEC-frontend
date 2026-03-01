import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector } from '../../store';
import type { QRPaymentData } from '../../utils/qrDecode';
import walletService from '../../services/walletService';

interface QRPaymentConfirmModalProps {
  visible: boolean;
  paymentData: QRPaymentData | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QRPaymentConfirmModal({
  visible, paymentData, onClose, onSuccess,
}: QRPaymentConfirmModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const balance = useAppSelector(s => s.user.balance);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setPaying(false);
      setError(null);
      setSuccess(false);
    }
  }, [visible]);

  if (!paymentData) return null;

  const insufficientBalance = balance < paymentData.amount;
  const balanceAfter = balance - paymentData.amount;

  const handlePay = async () => {
    if (paying || insufficientBalance) return;
    setPaying(true);
    setError(null);
    try {
      await walletService.payAdhocPayment(paymentData.paymentId);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message
        || e?.response?.data?.message
        || e?.message
        || 'Payment failed. Please try again.';
      setError(msg);
      setPaying(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={paying ? undefined : onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {success ? (
            /* Success State */
            <View style={styles.successContainer}>
              <View style={styles.successCircle}>
                <Icon name="checkmark" size={40} color="#fff" />
              </View>
              <Text style={styles.successTitle}>Payment Successful!</Text>
              <Text style={styles.successAmount}>Rs. {paymentData.amount}</Text>
              <Text style={styles.successHint}>Paid from your wallet</Text>
            </View>
          ) : (
            <>
              {/* Title */}
              <Text style={styles.title}>Confirm Payment</Text>

              {/* Payment Info Card */}
              <View style={styles.paymentInfoCard}>
                <Text style={styles.paymentForLabel}>Payment for</Text>
                <Text style={styles.paymentTitle}>{paymentData.title || 'Payment'}</Text>
                {paymentData.shopName ? (
                  <Text style={styles.paymentFrom}>From: {paymentData.shopName}</Text>
                ) : null}
              </View>

              {/* Amount Row */}
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Amount</Text>
                <Text style={styles.rowAmountValue}>Rs. {paymentData.amount}</Text>
              </View>

              {/* Your Balance Row */}
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Your Balance</Text>
                <Text style={[styles.rowBalanceValue, insufficientBalance && styles.balanceInsufficient]}>
                  Rs. {balance}
                </Text>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Balance After Row */}
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Balance After</Text>
                <Text style={[styles.rowAfterValue, insufficientBalance && styles.balanceInsufficient]}>
                  Rs. {insufficientBalance ? '—' : balanceAfter}
                </Text>
              </View>

              {insufficientBalance && (
                <Text style={styles.warningText}>Insufficient wallet balance</Text>
              )}

              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              {/* Buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                  disabled={paying}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, (insufficientBalance || paying) && styles.confirmBtnDisabled]}
                  onPress={handlePay}
                  activeOpacity={0.8}
                  disabled={insufficientBalance || paying}
                >
                  {paying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 20,
  },
  paymentInfoCard: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  paymentForLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  paymentFrom: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  rowLabel: {
    fontSize: 15,
    color: colors.mutedForeground,
  },
  rowAmountValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.foreground,
  },
  rowBalanceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3b82f6',
  },
  rowAfterValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  balanceInsufficient: {
    color: '#ef4444',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  warningText: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#22c55e',
    marginBottom: 4,
  },
  successHint: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
});
