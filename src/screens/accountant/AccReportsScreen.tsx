import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../theme/colors';
import { Transaction } from '../../types';
import * as accountantService from '../../services/accountantService';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type FilterType = 'today' | 'week' | 'month' | 'all';

export default function AccReportsScreen() {
  const [filter, setFilter] = useState<FilterType>('month');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const now = new Date();
      let startDate: string | undefined;
      switch (filter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          break;
        case 'week':
          const w = new Date(now); w.setDate(w.getDate() - 7);
          startDate = w.toISOString();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          break;
      }
      const data = await accountantService.getTransactions({ startDate, limit: 200 });
      setTransactions(data.transactions || []);
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);

  const totalCredits = transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
  const totalDebits = transactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);
  const net = totalCredits - totalDebits;

  const filters: { key: FilterType; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'all', label: 'All' },
  ];

  const summaryCards = [
    { label: 'Total Credits', value: `₹${totalCredits.toLocaleString()}`, icon: 'arrow-down-circle', color: '#16a34a' },
    { label: 'Total Debits', value: `₹${totalDebits.toLocaleString()}`, icon: 'arrow-up-circle', color: '#ef4444' },
    { label: 'Net Flow', value: `₹${net.toLocaleString()}`, icon: 'swap-horizontal', color: net >= 0 ? '#16a34a' : '#ef4444' },
    { label: 'Transactions', value: String(transactions.length), icon: 'receipt-outline', color: '#3b82f6' },
  ];

  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[colors.primary]} />}>

      <Text style={styles.title}>Financial Reports</Text>

      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity key={f.key} style={[styles.filterChip, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}>
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} /> : (
        <>
          <View style={styles.grid}>
            {summaryCards.map(c => (
              <View key={c.label} style={styles.card}>
                <Icon name={c.icon} size={24} color={c.color} />
                <Text style={styles.cardValue}>{c.value}</Text>
                <Text style={styles.cardLabel}>{c.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>No transactions for this period</Text>
          ) : (
            transactions.slice(0, 30).map(txn => (
              <View key={txn.id} style={styles.txnRow}>
                <View style={[styles.txnIcon, { backgroundColor: txn.type === 'credit' ? '#dcfce7' : '#fef2f2' }]}>
                  <Icon name={txn.type === 'credit' ? 'arrow-down' : 'arrow-up'} size={16}
                    color={txn.type === 'credit' ? '#16a34a' : '#ef4444'} />
                </View>
                <View style={styles.txnInfo}>
                  <Text style={styles.txnDesc} numberOfLines={1}>{txn.description || txn.type}</Text>
                  <Text style={styles.txnTime}>{new Date(txn.createdAt).toLocaleString()}</Text>
                </View>
                <Text style={[styles.txnAmount, { color: txn.type === 'credit' ? '#16a34a' : '#ef4444' }]}>
                  {txn.type === 'credit' ? '+' : '-'}₹{txn.amount}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, color: colors.textMuted },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  card: { width: '48%' as any, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 4 },
  cardValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  cardLabel: { fontSize: 11, color: colors.textMuted },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 20 },
  txnRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  txnIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  txnInfo: { flex: 1, marginLeft: 12 },
  txnDesc: { fontSize: 14, fontWeight: '600', color: colors.text },
  txnTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700' },
});
