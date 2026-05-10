import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { updateQRPaymentAmount, cancelQRPayment } from '../../store/slices/userSlice';
import { QRPayment } from '../../types';
interface QRPaymentDisplayModalProps {
  visible: boolean;
  payment: QRPayment | null;
  onClose: () => void;
  onPaymentUpdated?: () => void;
}

export default function QRPaymentDisplayModal({ visible, payment, onClose, onPaymentUpdated }: QRPaymentDisplayModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const shopDetails = useAppSelector(s => s.user.shopDetails);
  const slideAnim = useMemo(() => new Animated.Value(400), []);

  const [editingAmount, setEditingAmount] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(400);
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const canEdit = payment?.status === 'active' && payment?.paidCount === 0;
  const canCancel = payment?.status === 'active';

  const handleEditAmount = async () => {
    const newAmount = parseFloat(amountInput);
    if (!payment || isNaN(newAmount) || newAmount <= 0) return;
    setActionLoading(true);
    const result = await dispatch(updateQRPaymentAmount({ id: payment.id, amount: newAmount }));
    setActionLoading(false);
    if (updateQRPaymentAmount.fulfilled.match(result)) {
      setEditingAmount(false);
      onPaymentUpdated?.();
    } else {
      Alert.alert('Error', (result.payload as string) || 'Failed to update amount');
    }
  };

  const handleCancel = () => {
    if (!payment) return;
    Alert.alert('Cancel QR Payment', 'Are you sure you want to cancel this QR payment?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          const result = await dispatch(cancelQRPayment({ id: payment.id }));
          setActionLoading(false);
          if (cancelQRPayment.fulfilled.match(result)) {
            onPaymentUpdated?.();
            onClose();
          } else {
            Alert.alert('Error', (result.payload as string) || 'Failed to cancel');
          }
        },
      },
    ]);
  };

  if (!payment) return null;

  // Compact QR data for faster scanning (~50 chars vs ~200)
  // t=type, p=paymentId, a=amount, s=shopId
  const qrValue = JSON.stringify({
    t: 'qp',
    p: payment.id,
    a: payment.amount,
    s: user?.shopId || '',
  });

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handleBar}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payment QR Code</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Icon name="close" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Payment Info */}
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentTitle}>{payment.title}</Text>
          <Text style={styles.paymentAmount}>Rs. {payment.amount}</Text>
          <Text style={styles.paymentLabel}>One-time use only</Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={qrValue}
              size={240}
              backgroundColor="#fff"
              color="#000"
              ecl="M"
              logo={require('../../assets/icons/appicon.png')}
              logoSize={48}
              logoBackgroundColor="#fff"
              logoBorderRadius={12}
              logoMargin={4}
            />
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          Show this QR code to the student. They can scan it to pay from their wallet.
        </Text>

        {/* Edit Amount inline input */}
        {editingAmount && (
          <View style={styles.editRow}>
            <TextInput
              style={styles.amountInput}
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="numeric"
              placeholder="New amount"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            <TouchableOpacity style={styles.confirmBtn} onPress={handleEditAmount} disabled={actionLoading} activeOpacity={0.8}>
              {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmBtnText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.discardBtn} onPress={() => setEditingAmount(false)} activeOpacity={0.8}>
              <Text style={styles.discardBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {canEdit && !editingAmount && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => { setAmountInput(String(payment.amount)); setEditingAmount(true); }}
              activeOpacity={0.8}
            >
              <Icon name="pencil-outline" size={15} color="#f59e0b" />
              <Text style={styles.editBtnText}>Edit Amount</Text>
            </TouchableOpacity>
          )}
          {canCancel && !editingAmount && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={actionLoading} activeOpacity={0.8}>
              {actionLoading ? <ActivityIndicator size="small" color="#ef4444" /> : (
                <>
                  <Icon name="close-circle-outline" size={15} color="#ef4444" />
                  <Text style={styles.cancelBtnText}>Cancel QR</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  handleBar: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentInfo: {
    backgroundColor: colors.muted,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 6,
  },
  paymentAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#22c55e',
    marginBottom: 4,
  },
  paymentLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrWrapper: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  footerText: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  actionRow: {
    flexDirection: 'column',
    gap: 10,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.muted,
  },
  confirmBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  discardBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  discardBtnText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 16,
    paddingVertical: 12,
  },
  editBtnText: { fontSize: 15, fontWeight: '700', color: '#f59e0b' },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 16,
    paddingVertical: 12,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  doneBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
