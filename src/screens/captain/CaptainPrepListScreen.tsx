import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchActiveShopOrders } from '../../store/slices/ordersSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';

interface PrepItem {
  name: string;
  totalQty: number;
  pendingQty: number;
  preparingQty: number;
  orderCount: number;
}

export default function CaptainPrepListScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const shopOrders = useSelector((s: RootState) => s.orders.shopOrders);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      await dispatch(fetchActiveShopOrders());
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Aggregate items from pending + preparing orders
  const prepItems = useMemo(() => {
    const activeOrders = shopOrders.filter(o =>
      o.status === 'pending' || o.status === 'preparing'
    );

    const itemMap = new Map<string, PrepItem>();

    activeOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = itemMap.get(item.name);
        if (existing) {
          existing.totalQty += item.quantity;
          if (order.status === 'pending') existing.pendingQty += item.quantity;
          if (order.status === 'preparing') existing.preparingQty += item.quantity;
          existing.orderCount += 1;
        } else {
          itemMap.set(item.name, {
            name: item.name,
            totalQty: item.quantity,
            pendingQty: order.status === 'pending' ? item.quantity : 0,
            preparingQty: order.status === 'preparing' ? item.quantity : 0,
            orderCount: 1,
          });
        }
      });
    });

    return Array.from(itemMap.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [shopOrders]);

  // Summary stats
  const totalItems = prepItems.reduce((sum, i) => sum + i.totalQty, 0);
  const pendingOrders = shopOrders.filter(o => o.status === 'pending').length;
  const preparingOrders = shopOrders.filter(o => o.status === 'preparing').length;

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.headerTitleRow}>
              <Icon name="restaurant" size={20} color={colors.accent} />
              <Text style={styles.headerTitle}>Prep List</Text>
            </View>
            <Text style={styles.headerSubtitle}>Items to prepare for the kitchen</Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.refreshBtn}
            activeOpacity={0.7}
          >
            <Icon name="refresh" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>{totalItems}</Text>
            <Text style={styles.summaryLabel}>Total Items</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.amberBg, borderColor: 'rgba(245,158,11,0.2)' }]}>
            <Text style={[styles.summaryValue, { color: colors.amber[500] }]}>{pendingOrders}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.blueBg, borderColor: 'rgba(59,130,246,0.2)' }]}>
            <Text style={[styles.summaryValue, { color: colors.blue[500] }]}>{preparingOrders}</Text>
            <Text style={styles.summaryLabel}>Preparing</Text>
          </View>
        </View>

        {/* Item List */}
        {prepItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Icon name="cube-outline" size={28} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>No items to prepare right now</Text>
          </View>
        ) : (
          <View style={styles.itemList}>
            {prepItems.map(item => (
              <View key={item.name} style={styles.itemCard}>
                {/* Quantity Badge */}
                <View style={[
                  styles.qtyBadge,
                  {
                    backgroundColor: item.totalQty >= 5
                      ? colors.errorBg
                      : item.totalQty >= 3
                        ? colors.amberBg
                        : colors.accentBg,
                  },
                ]}>
                  <Text style={[
                    styles.qtyText,
                    {
                      color: item.totalQty >= 5
                        ? colors.destructive
                        : item.totalQty >= 3
                          ? colors.amber[500]
                          : colors.accent,
                    },
                  ]}>
                    {item.totalQty}
                  </Text>
                </View>

                {/* Item Details */}
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.itemStatusRow}>
                    {item.pendingQty > 0 && (
                      <View style={styles.statusChip}>
                        <Icon name="time-outline" size={10} color={colors.amber[500]} />
                        <Text style={[styles.statusChipText, { color: colors.amber[500] }]}>
                          {item.pendingQty} pending
                        </Text>
                      </View>
                    )}
                    {item.preparingQty > 0 && (
                      <View style={styles.statusChip}>
                        <Icon name="flame-outline" size={10} color={colors.blue[500]} />
                        <Text style={[styles.statusChipText, { color: colors.blue[500] }]}>
                          {item.preparingQty} cooking
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Order Count */}
                <Text style={styles.orderCount}>
                  {item.orderCount} order{item.orderCount > 1 ? 's' : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  headerSubtitle: { fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  refreshBtn: {
    padding: 10, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: {
    flex: 1, padding: 12, borderRadius: 16,
    borderWidth: 1, alignItems: 'center',
  },
  summaryValue: { fontSize: 24, fontWeight: '800' },
  summaryLabel: { fontSize: 10, color: colors.mutedForeground, fontWeight: '500', marginTop: 2 },

  // Items
  itemList: { gap: 8 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  qtyBadge: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyText: { fontSize: 18, fontWeight: '800' },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  itemStatusRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statusChipText: { fontSize: 11 },
  orderCount: { fontSize: 12, color: colors.mutedForeground },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accentBg, justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  emptySubtitle: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center' },
});
