import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StudentHomeStackParamList, TransactionDetail } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import walletService from '../../services/walletService';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'TransactionDetail'>;

function sourceLabel(source?: string): string {
  switch (source) {
    case 'cash_deposit': return 'Cash Deposit';
    case 'online_payment': return 'Razorpay Online';
    case 'complementary': return 'Complementary';
    case 'pg_direct': return 'Payment Gateway';
    case 'refund': return 'Refund';
    case 'adjustment': return 'Adjustment';
    case 'adhoc_payment': return 'Adhoc Payment';
    case 'shop_qr_payment': return 'QR Payment';
    case 'order_payment': return 'Order Payment';
    default: return source || 'Wallet';
  }
}

function statusColor(status?: string): string {
  switch (status) {
    case 'completed': return '#22c55e';
    case 'pending': return '#f59e0b';
    case 'failed': return '#ef4444';
    case 'cancelled': return '#6b7280';
    default: return '#6b7280';
  }
}

export default function TransactionDetailScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { transactionId } = route.params;

  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDetail = async () => {
    try {
      setError(null);
      const data = await walletService.getTransactionDetail(transactionId);
      setDetail(data);
    } catch {
      setError('Failed to load transaction details');
    }
  };

  // Auto-refresh transaction detail every time the screen gains focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        setLoading(true);
        await fetchDetail();
        if (active) setLoading(false);
      };
      load();
      return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transactionId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDetail();
    setRefreshing(false);
  };

  const tx = detail?.transaction;
  const rzp = detail?.razorpay;
  const order = detail?.order;
  const isCredit = tx?.type === 'credit' || tx?.type === 'refund';

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    }) + ' at ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    }).toLowerCase();
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transaction Details</Text>
          <View style={styles.backBtn} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Icon name="alert-circle-outline" size={44} color={colors.textMuted} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh} activeOpacity={0.7}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : tx ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          >
            {/* Amount Hero */}
            <View style={styles.amountCard}>
              <View style={[styles.amountIcon, { backgroundColor: isCredit ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                <Icon
                  name={isCredit ? 'arrow-down-outline' : 'arrow-up-outline'}
                  size={28}
                  color={isCredit ? '#22c55e' : '#ef4444'}
                />
              </View>
              <Text style={[styles.amountText, { color: isCredit ? '#22c55e' : '#ef4444' }]}>
                {isCredit ? '+' : '-'} Rs. {tx.amount}
              </Text>
              <Text style={styles.amountDesc}>{tx.description}</Text>
              <View style={[styles.statusPill, { backgroundColor: statusColor(tx.status) + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(tx.status) }]} />
                <Text style={[styles.statusText, { color: statusColor(tx.status) }]}>
                  {(tx.status || 'completed').toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Transaction Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transaction Info</Text>
              <View style={styles.card}>
                <InfoRow label="Type" value={tx.type === 'credit' ? 'Credit' : tx.type === 'debit' ? 'Debit' : 'Refund'} colors={colors} />
                <InfoRow label="Source" value={sourceLabel(tx.source)} colors={colors} />
                <InfoRow label="Date" value={formatDate(tx.createdAt)} colors={colors} />
                <InfoRow label="Balance Before" value={`Rs. ${tx.balanceBefore ?? '-'}`} colors={colors} />
                <InfoRow label="Balance After" value={`Rs. ${tx.balanceAfter ?? '-'}`} colors={colors} />
                {tx.processedBy && (
                  <InfoRow label="Processed By" value={tx.processedBy.name} colors={colors} />
                )}
                <InfoRow label="Transaction ID" value={tx.id} colors={colors} mono />
              </View>
            </View>

            {/* Razorpay Info */}
            {rzp && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Razorpay Payment Details</Text>
                <View style={styles.card}>
                  <InfoRow label="Order ID" value={rzp.razorpayOrderId} colors={colors} mono />
                  {rzp.razorpayPaymentId && (
                    <InfoRow label="Payment ID" value={rzp.razorpayPaymentId} colors={colors} mono />
                  )}
                  <InfoRow label="Receipt" value={rzp.receipt} colors={colors} mono />
                  <InfoRow label="Payment Status" value={rzp.status.toUpperCase()} colors={colors}
                    valueColor={rzp.status === 'paid' ? '#22c55e' : rzp.status === 'failed' ? '#ef4444' : '#f59e0b'} />
                  <InfoRow label="Wallet Credited" value={rzp.walletCredited ? 'Yes' : 'No'} colors={colors}
                    valueColor={rzp.walletCredited ? '#22c55e' : '#ef4444'} />
                  <InfoRow label="Payment Date" value={formatDate(rzp.createdAt)} colors={colors} />
                </View>
              </View>
            )}

            {/* Order Info */}
            {order && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order Details</Text>
                <View style={styles.card}>
                  {order.orderNumber && <InfoRow label="Order Number" value={`#${order.orderNumber}`} colors={colors} />}
                  {order.shopName && <InfoRow label="Shop" value={order.shopName} colors={colors} />}
                  {order.total !== undefined && <InfoRow label="Order Total" value={`Rs. ${order.total}`} colors={colors} />}
                  {order.status && <InfoRow label="Order Status" value={order.status.toUpperCase()} colors={colors}
                    valueColor={order.status === 'completed' ? '#22c55e' : order.status === 'cancelled' ? '#ef4444' : '#3b82f6'} />}
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        ) : null}
      </View>
    </ScreenWrapper>
  );
}

function InfoRow({ label, value, colors, mono, valueColor }: {
  label: string;
  value: string;
  colors: ThemeColors;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 13, color: colors.textMuted, flex: 1 }}>{label}</Text>
      <Text style={{
        fontSize: 13, fontWeight: '600',
        color: valueColor || colors.text,
        flex: 1.5, textAlign: 'right',
        ...(mono ? { fontFamily: 'monospace', fontSize: 11 } : {}),
      }} selectable>{value}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.accent },
  retryText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  content: { padding: 20 },

  // Amount hero
  amountCard: {
    alignItems: 'center', padding: 24, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    marginBottom: 20,
  },
  amountIcon: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  amountText: { fontSize: 32, fontWeight: '900', marginBottom: 6 },
  amountDesc: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 12 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  // Sections
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
});
