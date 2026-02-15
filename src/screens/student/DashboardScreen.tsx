import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchMyActiveOrders } from '../../store/slices/ordersSlice';
import { fetchShops } from '../../store/slices/menuSlice';
import { colors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Dashboard'>;

export default function StudentDashboard({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const { shops } = useAppSelector(s => s.menu);
  const { activeOrders } = useAppSelector(s => s.orders);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    await Promise.all([
      dispatch(fetchShops()),
      dispatch(fetchMyActiveOrders()),
    ]);
  }, [dispatch]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const canteenShop = shops.find(s => s.category === 'canteen');
  const laundryShop = shops.find(s => s.category === 'laundry');
  const stationeryShop = shops.find(s => s.category === 'stationery');

  const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(234,179,8,0.15)', color: '#eab308', label: 'Ordered' },
    preparing: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Preparing' },
    ready: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Ready' },
    partially_delivered: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Partial' },
  };

  return (
    <ScreenWrapper>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetHi}>Hello,</Text>
        <Text style={styles.greetName}>{user?.name?.split(' ')[0] || 'Student'} 👋</Text>
      </View>

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <View style={styles.section}>
          {activeOrders.map(order => {
            const sc = statusConfig[order.status] || statusConfig.pending;
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.activeOrderCard}
                onPress={() => navigation.getParent()?.navigate('Orders')}
                activeOpacity={0.8}>
                <View style={styles.activeOrderIcon}>
                  <Icon name="cube-outline" size={24} color="#3b82f6" />
                </View>
                <View style={styles.activeOrderInfo}>
                  <Text style={styles.activeOrderItems} numberOfLines={1}>
                    {order.items.map(i => i.name).join(', ')}
                  </Text>
                  <View style={styles.activeOrderMeta}>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                    <Text style={styles.tokenText}>#{order.pickupToken}</Text>
                  </View>
                </View>
                <Icon name="chevron-forward" size={20} color="#3b82f6" />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Service Stores */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Services</Text>
        <View style={styles.storeGrid}>
          {/* Canteen */}
          <TouchableOpacity
            style={[styles.storeCard, !canteenShop?.isActive && styles.storeCardClosed]}
            onPress={() => canteenShop?.isActive && navigation.navigate('Menu', { shopId: canteenShop.id, shopName: canteenShop.name })}
            activeOpacity={0.8}>
            <View style={[styles.storeIconBg, { backgroundColor: 'rgba(249,115,22,0.15)' }]}>
              <Icon name="restaurant-outline" size={28} color="#f97316" />
            </View>
            <Text style={styles.storeName}>Canteen</Text>
            <Text style={[styles.storeStatus, { color: canteenShop?.isActive ? colors.success : colors.danger }]}>
              {canteenShop?.isActive ? 'Open' : 'Closed'}
            </Text>
          </TouchableOpacity>

          {/* Laundry */}
          <TouchableOpacity
            style={[styles.storeCard, !laundryShop?.isActive && styles.storeCardClosed]}
            onPress={() => laundryShop?.isActive && navigation.navigate('Menu', { shopId: laundryShop.id, shopName: laundryShop.name })}
            activeOpacity={0.8}>
            <View style={[styles.storeIconBg, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Icon name="water-outline" size={28} color="#3b82f6" />
            </View>
            <Text style={styles.storeName}>Laundry</Text>
            <Text style={[styles.storeStatus, { color: laundryShop?.isActive ? colors.success : colors.danger }]}>
              {laundryShop?.isActive ? 'Open' : 'Closed'}
            </Text>
          </TouchableOpacity>

          {/* Stationery */}
          <TouchableOpacity
            style={[styles.storeCard, !stationeryShop?.isActive && styles.storeCardClosed]}
            onPress={() => stationeryShop?.isActive && navigation.navigate('Menu', { shopId: stationeryShop.id, shopName: stationeryShop.name })}
            activeOpacity={0.8}>
            <View style={[styles.storeIconBg, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
              <Icon name="document-text-outline" size={28} color="#a855f7" />
            </View>
            <Text style={styles.storeName}>Stationery</Text>
            <Text style={[styles.storeStatus, { color: stationeryShop?.isActive ? colors.success : colors.danger }]}>
              {stationeryShop?.isActive ? 'Open' : 'Closed'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('OrderHistory')} activeOpacity={0.7}>
            <Icon name="time-outline" size={22} color={colors.primary} />
            <Text style={styles.quickActionText}>Order History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Leaderboard')} activeOpacity={0.7}>
            <Icon name="trophy-outline" size={22} color="#eab308" />
            <Text style={styles.quickActionText}>Leaderboard</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Wallet Card */}
      <TouchableOpacity style={styles.walletCard} activeOpacity={0.8}>
        <View style={styles.walletLeft}>
          <Text style={styles.walletLabel}>Wallet Balance</Text>
          <Text style={styles.walletAmount}>Rs. {user?.balance || 0}</Text>
        </View>
        <View style={styles.walletIcon}>
          <Icon name="wallet-outline" size={28} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  greeting: { marginBottom: 20 },
  greetHi: { fontSize: 16, color: colors.textSecondary },
  greetName: { fontSize: 26, fontWeight: '800', color: colors.text },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  activeOrderCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 8,
    backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
  },
  activeOrderIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  activeOrderInfo: { flex: 1 },
  activeOrderItems: { fontSize: 14, fontWeight: '600', color: colors.text },
  activeOrderMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '600' },
  tokenText: { fontSize: 12, color: colors.textMuted },
  storeGrid: { flexDirection: 'row', gap: 12 },
  storeCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  storeCardClosed: { opacity: 0.5 },
  storeIconBg: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  storeName: { fontSize: 13, fontWeight: '600', color: colors.text },
  storeStatus: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  quickActions: { flexDirection: 'row', gap: 12 },
  quickAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  quickActionText: { fontSize: 13, fontWeight: '500', color: colors.text },
  walletCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary, borderRadius: 20, padding: 20,
  },
  walletLeft: {},
  walletLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  walletAmount: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 2 },
  walletIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
});
