import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { Order } from '../../types';
import { useAppSelector } from '../../store';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type FilterType = 'today' | 'week' | 'month' | 'all';

export default function SAAnalyticsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<FilterType>('month');
  const orders = useAppSelector(s => s.orders.orders) as Order[];

  const filteredOrders = useMemo(() => {
    const now = new Date();
    return orders.filter(o => {
      if (o.status !== 'completed') return false;
      const d = new Date(o.createdAt);
      switch (filter) {
        case 'today': return d.toDateString() === now.toDateString();
        case 'week': { const w = new Date(now); w.setDate(w.getDate() - 7); return d >= w; }
        case 'month': return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        default: return true;
      }
    });
  }, [orders, filter]);

  const totalRevenue = useMemo(() => filteredOrders.reduce((sum, o) => sum + o.total, 0), [filteredOrders]);
  const uniqueCustomers = useMemo(() => new Set(filteredOrders.map(o => o.userId)).size, [filteredOrders]);

  const topItems = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    filteredOrders.forEach(o => o.items.forEach(item => {
      const key = item.name;
      const existing = map.get(key) || { name: key, qty: 0, revenue: 0 };
      existing.qty += item.quantity;
      existing.revenue += item.price * item.quantity;
      map.set(key, existing);
    }));
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [filteredOrders]);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'all', label: 'All Time' },
  ];

  const metrics = [
    { label: 'Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: 'trending-up', color: '#10b981' },
    { label: 'Orders', value: String(filteredOrders.length), icon: 'receipt-outline', color: '#3b82f6' },
    { label: 'Customers', value: String(uniqueCustomers), icon: 'people-outline', color: '#f59e0b' },
  ];

  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Analytics & Reports</Text>

      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity key={f.key} style={[styles.filterChip, filter === f.key && styles.filterActive]} onPress={() => setFilter(f.key)}>
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.metricsRow}>
        {metrics.map(m => (
          <View key={m.label} style={styles.metricCard}>
            <Icon name={m.icon} size={20} color={m.color} />
            <Text style={styles.metricValue}>{m.value}</Text>
            <Text style={styles.metricLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Top Selling Items</Text>
      {topItems.length === 0 ? (
        <Text style={styles.emptyText}>No data for this period</Text>
      ) : (
        topItems.map((item, i) => (
          <View key={item.name} style={styles.itemRow}>
            <View style={[styles.rankBadge, i === 0 && styles.gold, i === 1 && styles.silver, i === 2 && styles.bronze]}>
              <Text style={styles.rankText}>{i + 1}</Text>
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDetail}>{item.qty} sold</Text>
            </View>
            <Text style={styles.itemRevenue}>₹{item.revenue.toLocaleString()}</Text>
          </View>
        ))
      )}
    </ScrollView>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 50 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, color: colors.textMuted },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  metricCard: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  metricLabel: { fontSize: 11, color: colors.textMuted },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 20 },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  rankBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  gold: { backgroundColor: '#fbbf24' },
  silver: { backgroundColor: '#9ca3af' },
  bronze: { backgroundColor: '#d97706' },
  rankText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemDetail: { fontSize: 12, color: colors.textMuted },
  itemRevenue: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
