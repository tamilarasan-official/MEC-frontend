import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StudentHomeStackParamList } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchWalletBalance, fetchTransactions } from '../../store/slices/userSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type Period = 'today' | 'week' | 'month' | 'all'

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
]

function getPeriodDates(period: Period): { startDate?: string; endDate?: string } {
  const now = new Date()
  if (period === 'all') return {}
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { startDate: start.toISOString() }
  }
  if (period === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    return { startDate: start.toISOString() }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { startDate: start.toISOString() }
}

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Wallet'>;

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function WalletScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { balance, transactions } = useAppSelector(s => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('all');

  const loadTransactions = useCallback(async (p: Period) => {
    try {
      await Promise.all([
        dispatch(fetchWalletBalance()),
        dispatch(fetchTransactions(getPeriodDates(p))),
      ]);
      setError(null);
    } catch {
      setError('Something went wrong. Pull down to retry.');
    }
  }, [dispatch]);

  // Refresh balance & transactions every time the screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadTransactions(period);
    }, [loadTransactions, period])
  );

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    loadTransactions(p);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions(period);
    setRefreshing(false);
  };

  const isCredit = (type: string) => type === 'credit' || type === 'refund';

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Wallet</Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={transactions}
          keyExtractor={tx => tx.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {/* Balance Card */}
              <View style={styles.balanceCard}>
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceAmount}>Rs. {balance}</Text>
                <Text style={styles.balanceHint}>Visit the accountant office to add money</Text>
              </View>

              {/* Period Filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow} contentContainerStyle={styles.periodContent}>
                {PERIODS.map(p => (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.periodPill, period === p.value && styles.periodPillActive]}
                    onPress={() => handlePeriodChange(p.value)}
                    activeOpacity={0.7}
                    accessibilityLabel={p.label}
                    accessibilityRole="button">
                    <Text style={[styles.periodPillText, period === p.value && styles.periodPillTextActive]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Transaction History header */}
              {transactions.length > 0 && (
                <Text style={styles.sectionTitle}>Transaction History</Text>
              )}
            </>
          }
          ListEmptyComponent={
            error ? (
              <View style={styles.empty}>
                <Icon name="alert-circle-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>{error}</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Icon name="receipt-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            )
          }
          renderItem={({ item: tx }) => {
            const credit = isCredit(tx.type);
            return (
              <TouchableOpacity
                style={styles.txRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('TransactionDetail', { transactionId: tx.id })}
                accessibilityLabel={`${tx.description}, Rs ${tx.amount}`}
                accessibilityRole="button">
                <View style={[styles.txIconWrap, credit ? styles.txIconCredit : styles.txIconDebit]}>
                  <Icon
                    name={credit ? 'arrow-down' : 'arrow-up'}
                    size={16}
                    color={credit ? '#10b981' : '#f97316'}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                  <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, credit ? styles.txCredit : styles.txDebit]}>
                    {credit ? '+' : '-'}Rs.{tx.amount}
                  </Text>
                  <Icon name="chevron-forward" size={14} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </ScreenWrapper>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  headerSpacer: { width: 36 },
  listContent: { padding: 16, paddingBottom: 40 },

  // Balance card
  balanceCard: {
    borderRadius: 20, padding: 24, marginBottom: 28, overflow: 'hidden',
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500', marginBottom: 6 },
  balanceAmount: { fontSize: 36, fontWeight: '900', color: '#fff', marginBottom: 8 },
  balanceHint: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 12,
  },

  // Period filter
  periodRow: { marginBottom: 20 },
  periodContent: { gap: 8, paddingRight: 4 },
  periodPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
  },
  periodPillActive: { backgroundColor: c.primary, borderColor: c.primary },
  periodPillText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  periodPillTextActive: { color: '#fff' },

  // Transaction row
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, marginBottom: 8,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
  },
  txIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  txIconDebit: { backgroundColor: 'rgba(249,115,22,0.15)' },
  txIconCredit: { backgroundColor: 'rgba(16,185,129,0.15)' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 13, fontWeight: '500', color: c.text },
  txDate: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  txRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txDebit: { color: '#ef4444' },
  txCredit: { color: '#10b981' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, color: c.textSecondary },
});
