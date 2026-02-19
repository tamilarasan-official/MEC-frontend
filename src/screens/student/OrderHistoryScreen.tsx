import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, Order } from '../../types';
import orderService from '../../services/orderService';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'OrderHistory'>;

export default function OrderHistoryScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'completed' | 'cancelled'>('completed');

  const fetchOrders = async () => {
    try {
      const data = await orderService.getMyOrders();
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch order history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);
  const cancelledOrders = useMemo(() => orders.filter(o => o.status === 'cancelled'), [orders]);
  const displayOrders = activeTab === 'completed' ? completedOrders : cancelledOrders;

  if (loading) {
    return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order History</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.tabs}>
          {(['completed', 'cancelled'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'completed' ? `Completed (${completedOrders.length})` : `Cancelled (${cancelledOrders.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
          {displayOrders.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="cube-outline" size={36} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyText}>No past orders yet</Text>
            </View>
          ) : (
            displayOrders.map(order => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderId}>#{order.id.slice(-8)}</Text>
                  <Text style={styles.orderDate}>
                    {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {order.items.map((item, idx) => (
                  <View key={`${order.id}-${idx}`} style={styles.orderItem}>
                    <Text style={styles.itemName}>{item.name} x{item.quantity}</Text>
                    <Text style={styles.itemPrice}>Rs.{(item.offerPrice ?? item.price) * item.quantity}</Text>
                  </View>
                ))}
                <View style={styles.orderFooter}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>Rs.{order.total}</Text>
                </View>
              </View>
            ))
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  tabs: {
    flexDirection: 'row', marginHorizontal: 16, borderRadius: 12, backgroundColor: c.card,
    borderWidth: 1, borderColor: c.border, overflow: 'hidden', marginBottom: 12, marginTop: 8,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: c.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  tabTextActive: { color: '#fff' },
  list: { padding: 16, paddingTop: 0 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: c.card,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  emptyText: { fontSize: 14, color: c.textSecondary },
  orderCard: {
    backgroundColor: c.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: c.border, marginBottom: 10,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderId: { fontSize: 13, fontWeight: '600', color: c.text },
  orderDate: { fontSize: 11, color: c.textSecondary },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemName: { fontSize: 13, color: c.text },
  itemPrice: { fontSize: 13, fontWeight: '500', color: c.text },
  orderFooter: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 8,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border,
  },
  totalLabel: { fontSize: 13, color: c.textSecondary },
  totalValue: { fontSize: 15, fontWeight: '700', color: c.primary },
  headerSpacer: { width: 36 },
  bottomSpacer: { height: 40 },
});
