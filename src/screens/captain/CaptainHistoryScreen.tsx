import React, { useCallback, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import orderService from '../../services/orderService';
import { Order } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { useFocusEffect } from '@react-navigation/native';
import CaptainHeader from '../../components/captain/CaptainHeader';
import CaptainProfileDropdown from '../../components/captain/CaptainProfileDropdown';

const PAGE_SIZE = 20;

export default function CaptainHistoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [total, setTotal] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const isFetchingRef = useRef(false);

  const loadPage = useCallback(async (pageNum: number, replace: boolean) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setError(null);
      const result = await orderService.getHistoryPage(pageNum, PAGE_SIZE);
      setOrders(prev => replace ? result.orders : [...prev, ...result.orders]);
      setHasNextPage(result.hasNextPage);
      setTotal(result.total);
      setPage(pageNum);
    } catch {
      setError('Failed to load order history. Pull down to retry.');
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadPage(1, true).finally(() => setLoading(false));
  }, [loadPage]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPage(1, true);
    setRefreshing(false);
  };

  const onLoadMore = async () => {
    if (!hasNextPage || loadingMore || isFetchingRef.current) return;
    setLoadingMore(true);
    await loadPage(page + 1, false);
    setLoadingMore(false);
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(o =>
      o.pickupToken?.toLowerCase().includes(q) ||
      o.orderNumber?.toString().includes(q) ||
      o.userName?.toLowerCase().includes(q),
    );
  }, [orders, searchQuery]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getItemsSummary = (order: Order) => {
    if (!order.items?.length) return 'No items';
    return order.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return { label: 'Delivered', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: 'checkmark-circle' as const };
      case 'cancelled':
      case 'rejected':
        return { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: 'close-circle' as const };
      default:
        return { label: status, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: 'ellipse' as const };
    }
  };

  const renderOrder = useCallback(({ item: order }: { item: Order }) => {
    const status = getStatusInfo(order.status);
    const token = order.orderNumber || order.pickupToken || order.id?.slice(-4) || '—';

    return (
      <View style={styles.orderCard}>
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.statusIcon, { backgroundColor: status.bg }]}>
              <Icon name={status.icon} size={20} color={status.color} />
            </View>
            <View>
              <Text style={styles.tokenText}>#{token}</Text>
              <Text style={styles.dateText}>{order.createdAt ? formatDate(order.createdAt) : ''}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Icon name={status.icon} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Icon name="person-outline" size={13} color={colors.mutedForeground} />
          <Text style={styles.infoText}>{order.userName || 'Unknown'}</Text>
        </View>

        <Text style={styles.itemsSummary} numberOfLines={2}>{getItemsSummary(order)}</Text>

        <View style={styles.bottomRow}>
          <View style={styles.totalWrap}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Rs. {order.total}</Text>
          </View>
          {!!order.completedAt && (
            <View style={styles.timeWrap}>
              <Icon name="time-outline" size={12} color={colors.mutedForeground} />
              <Text style={styles.timeText}>{formatDate(order.completedAt)}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }, [styles, colors]);

  const renderFooter = () => loadingMore
    ? <View style={styles.footerLoader}><ActivityIndicator size="small" color={colors.accent} /></View>
    : null;

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
      <View style={styles.container}>
        <CaptainHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showSearch={showSearch}
          onToggleSearch={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }}
          onProfilePress={() => setShowProfile(true)}
        />

        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {searchQuery ? `${filtered.length} results` : `${orders.length} of ${total} orders`}
          </Text>
          <TouchableOpacity onPress={onRefresh} activeOpacity={0.7} style={styles.refreshBtn}>
            <Icon name="refresh" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item, i) => item.id || String(i)}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          onEndReached={searchQuery ? undefined : onLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name={error ? 'alert-circle-outline' : 'document-text-outline'} size={48} color={error ? '#ef4444' : colors.mutedForeground} />
              <Text style={styles.emptyTitle}>{error ? 'Something went wrong' : 'No orders found'}</Text>
              <Text style={styles.emptySubtitle}>{error || 'Past orders will appear here'}</Text>
            </View>
          }
        />

        <CaptainProfileDropdown visible={showProfile} onClose={() => setShowProfile(false)} />
      </View>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  countRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10,
  },
  countText: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    justifyContent: 'center', alignItems: 'center',
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  orderCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  tokenText: { fontSize: 17, fontWeight: '800', color: colors.foreground },
  dateText: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  infoText: { fontSize: 13, color: colors.mutedForeground },

  itemsSummary: {
    fontSize: 14, fontWeight: '600', color: colors.foreground,
    marginBottom: 14, lineHeight: 20,
  },

  bottomRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalLabel: { fontSize: 14, color: colors.mutedForeground },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#10b981' },
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 12, color: colors.mutedForeground },

  footerLoader: { paddingVertical: 20, alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  emptySubtitle: { fontSize: 13, color: colors.mutedForeground },
});
