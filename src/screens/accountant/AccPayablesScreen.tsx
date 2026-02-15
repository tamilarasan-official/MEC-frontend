import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../theme/colors';
import { VendorPayable } from '../../types';
import * as accountantService from '../../services/accountantService';
import ScreenWrapper from '../../components/common/ScreenWrapper';

export default function AccPayablesScreen() {
  const [payables, setPayables] = useState<VendorPayable[]>([]);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPayables = useCallback(async () => {
    try {
      const data = await accountantService.getVendorPayables(period);
      setPayables(data.payables || []);
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, [period]);

  useEffect(() => { loadPayables(); }, [loadPayables]);

  const changeMonth = (dir: number) => {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setLoading(true);
  };

  const handleToggleTransfer = async (payable: VendorPayable) => {
    const newStatus = payable.transferStatus === 'completed' ? 'pending' : 'completed';
    Alert.alert(
      newStatus === 'completed' ? 'Mark as Transferred' : 'Mark as Pending',
      `${payable.shopName} — ₹${payable.payableAmount.toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: async () => {
            try {
              await accountantService.updateVendorTransfer(
                payable.shopId, period, payable.payableAmount, newStatus
              );
              loadPayables();
            } catch { Alert.alert('Error', 'Failed to update transfer'); }
          }
        },
      ]
    );
  };

  const totalPayable = payables.reduce((sum, p) => sum + p.payableAmount, 0);
  const completedPayable = payables.filter(p => p.transferStatus === 'completed').reduce((sum, p) => sum + p.payableAmount, 0);

  const monthLabel = (() => {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  })();

  const renderPayable = ({ item }: { item: VendorPayable }) => (
    <View style={styles.payableCard}>
      <View style={styles.payableHeader}>
        <View>
          <Text style={styles.shopName}>{item.shopName}</Text>
          <Text style={styles.shopCategory}>{item.category}</Text>
        </View>
        <View style={[styles.statusBadge, item.transferStatus === 'completed' ? styles.completedBadge : styles.pendingBadge]}>
          <Text style={[styles.statusText, item.transferStatus === 'completed' ? styles.completedText : styles.pendingText]}>
            {item.transferStatus === 'completed' ? 'Transferred' : 'Pending'}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Revenue</Text>
          <Text style={styles.metricValue}>₹{item.revenue.toLocaleString()}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Payable</Text>
          <Text style={[styles.metricValue, { color: '#f59e0b' }]}>₹{item.payableAmount.toLocaleString()}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Orders</Text>
          <Text style={styles.metricValue}>{item.orderCount}</Text>
        </View>
      </View>

      <TouchableOpacity style={[styles.transferBtn,
        item.transferStatus === 'completed' ? styles.undoBtn : styles.markBtn]}
        onPress={() => handleToggleTransfer(item)}>
        <Icon name={item.transferStatus === 'completed' ? 'arrow-undo' : 'checkmark-circle'}
          size={18} color={item.transferStatus === 'completed' ? '#f59e0b' : '#fff'} />
        <Text style={[styles.transferText,
          item.transferStatus === 'completed' ? styles.undoText : styles.markText]}>
          {item.transferStatus === 'completed' ? 'Undo Transfer' : 'Mark Transferred'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vendor Payables</Text>
      </View>

      {/* Month Navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => changeMonth(-1)}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)}>
          <Icon name="chevron-forward" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Payable</Text>
          <Text style={styles.summaryValue}>₹{totalPayable.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Transferred</Text>
          <Text style={[styles.summaryValue, { color: '#16a34a' }]}>₹{completedPayable.toLocaleString()}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList data={payables} keyExtractor={p => p.shopId}
          renderItem={renderPayable}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPayables(); }} colors={[colors.primary]} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No payables for this period</Text>} />
      )}
    </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 50 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 16 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text, minWidth: 160, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  summaryLabel: { fontSize: 12, color: colors.textMuted },
  summaryValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  payableCard: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  payableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  shopName: { fontSize: 16, fontWeight: '700', color: colors.text },
  shopCategory: { fontSize: 12, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  completedBadge: { backgroundColor: '#dcfce7' },
  pendingBadge: { backgroundColor: '#fef3c7' },
  statusText: { fontSize: 11, fontWeight: '600' },
  completedText: { color: '#16a34a' },
  pendingText: { color: '#d97706' },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metric: { flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 10, alignItems: 'center' },
  metricLabel: { fontSize: 11, color: colors.textMuted },
  metricValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },
  transferBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, paddingVertical: 10 },
  markBtn: { backgroundColor: '#16a34a' },
  undoBtn: { backgroundColor: '#fef3c7' },
  transferText: { fontSize: 14, fontWeight: '600' },
  markText: { color: '#fff' },
  undoText: { color: '#d97706' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
