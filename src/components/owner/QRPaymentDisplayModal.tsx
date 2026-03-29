import React, { useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector } from '../../store';
import { QRPayment } from '../../types';
import { useSecureScreen } from '../../utils/useSecureScreen';

interface QRPaymentDisplayModalProps {
  visible: boolean;
  payment: QRPayment | null;
  onClose: () => void;
}

export default function QRPaymentDisplayModal({ visible, payment, onClose }: QRPaymentDisplayModalProps) {
  useSecureScreen();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAppSelector(s => s.auth.user);
  const shopDetails = useAppSelector(s => s.user.shopDetails);
  const slideAnim = useMemo(() => new Animated.Value(400), []);
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

        {/* Done button */}
        <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
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
