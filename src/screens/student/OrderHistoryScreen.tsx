import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, Order } from '../../types';
import orderService from '../../services/orderService';
import { resolveImageUrl } from '../../utils/imageUrl';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'OrderHistory'>;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  completed: { label: 'Delivered', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: 'close-circle' },
};

const ITEM_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  delivered:  { label: 'Delivered',          color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  ready:      { label: 'Ready',             color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  preparing:  { label: 'Preparing',         color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  pending:    { label: 'Pending',           color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  rejected:   { label: 'Rejected & Refunded', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

type ServiceFilter = 'all' | 'food' | 'stationery';

export default function OrderHistoryScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');

  const fetchOrders = async () => {
    try {
      const data = await orderService.getMyOrders();
      setOrders(data);
      setError(null);
    } catch (err) {
      setError('Something went wrong. Pull down to retry.');
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

  const historyOrders = useMemo(() => {
    const base = orders
      .filter(o => o.status === 'completed' || o.status === 'cancelled')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (serviceFilter === 'food') return base.filter(o => o.serviceType !== 'stationery');
    if (serviceFilter === 'stationery') return base.filter(o => o.serviceType === 'stationery');
    return base;
  }, [orders, serviceFilter]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-IN', { month: 'short' });
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
    return `${day} ${month} ${year}, ${time}`;
  };

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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order History</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Service type filter pills */}
        <View style={styles.filterRow}>
          {([
            { key: 'all',        label: 'All' },
            { key: 'food',       label: 'Madras Kitchen' },
            { key: 'stationery', label: 'Stationery' },
          ] as { key: ServiceFilter; label: string }[]).map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, serviceFilter === f.key && styles.filterPillActive]}
              onPress={() => setServiceFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterPillText, serviceFilter === f.key && styles.filterPillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
          {error ? (
            <View style={styles.empty}>
              <Icon name="alert-circle-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          ) : historyOrders.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="cube-outline" size={36} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyText}>
                {serviceFilter === 'food' ? 'No Madras Kitchen orders yet' :
                 serviceFilter === 'stationery' ? 'No stationery orders yet' :
                 'No past orders yet'}
              </Text>
            </View>
          ) : (
            historyOrders.map(order => {
              const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG.completed;

              return (
                <View key={order.id} style={styles.orderCard}>
                  {/* Order ID + Status Badge */}
                  <View style={styles.orderTopRow}>
                    <Text style={styles.orderId} numberOfLines={1}>#{order.orderNumber || order.pickupToken || order.id?.slice(-6)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
                      <Icon name={statusConf.icon} size={14} color={statusConf.color} />
                      <Text style={[styles.statusText, { color: statusConf.color }]}>{statusConf.label}</Text>
                    </View>
                  </View>

                  {/* Date + Service Type Badge */}
                  <View style={styles.dateBadgeRow}>
                    <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                    {order.serviceType === 'stationery' && (
                      <View style={styles.serviceTypeBadge}>
                        <Icon name="print-outline" size={11} color="#8b5cf6" />
                        <Text style={styles.serviceTypeBadgeText}>Stationery</Text>
                      </View>
                    )}
                  </View>

                  {/* Stationery details OR food items */}
                  {(order.serviceType === 'stationery' && order.serviceDetails?.stationery?.pageCount != null) ? (
                    <View style={styles.stationeryDetails}>
                      <View style={styles.itemRow}>
                        <View style={[styles.itemIconWrap, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
                          <Icon name="print-outline" size={20} color="#8b5cf6" />
                        </View>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>Print Order</Text>
                          <Text style={styles.itemQty}>{order.shopName || 'Stationery Shop'}</Text>
                        </View>
                      </View>
                      <View style={styles.stationeryGrid}>
                        <View style={styles.stationeryCell}>
                          <Text style={styles.stationeryCellLabel}>Pages</Text>
                          <Text style={styles.stationeryCellValue}>{order.serviceDetails?.stationery?.pageCount ?? '-'}</Text>
                        </View>
                        <View style={styles.stationeryCell}>
                          <Text style={styles.stationeryCellLabel}>Copies</Text>
                          <Text style={styles.stationeryCellValue}>{order.serviceDetails?.stationery?.copies ?? '-'}</Text>
                        </View>
                        <View style={styles.stationeryCell}>
                          <Text style={styles.stationeryCellLabel}>Color</Text>
                          <Text style={styles.stationeryCellValue}>{order.serviceDetails?.stationery?.colorType === 'bw' ? 'B&W' : 'Color'}</Text>
                        </View>
                        <View style={styles.stationeryCell}>
                          <Text style={styles.stationeryCellLabel}>Paper</Text>
                          <Text style={styles.stationeryCellValue}>{order.serviceDetails?.stationery?.paperSize ?? '-'}</Text>
                        </View>
                      </View>
                      {order.serviceDetails?.stationery?.doubleSided && (
                        <Text style={styles.stationeryNote}>Double-sided printing</Text>
                      )}
                      {order.serviceDetails?.stationery?.specialInstructions ? (
                        <Text style={styles.stationeryNote} numberOfLines={2}>{order.serviceDetails.stationery.specialInstructions}</Text>
                      ) : null}
                    </View>
                  ) : (
                    order.items.map((item, idx) => {
                      const iStatus = item.itemStatus || (order.status === 'cancelled' ? 'rejected' : 'delivered');
                      const iConf = ITEM_STATUS_CONFIG[iStatus] || ITEM_STATUS_CONFIG.delivered;
                      const isRejected = iStatus === 'rejected';
                      const lineTotal = (item.offerPrice ?? item.price) * item.quantity;

                      return (
                        <View key={`${order.id}-${idx}`} style={styles.itemRow}>
                          <View style={styles.itemIconWrap}>
                            {item.image ? (
                              <Image source={{ uri: resolveImageUrl(item.image)! }} style={[styles.itemImage, isRejected && styles.itemImageRejected]} accessibilityLabel="Order item image" />
                            ) : (
                              <Icon name="restaurant-outline" size={18} color={colors.textSecondary} />
                            )}
                          </View>
                          <View style={styles.itemInfo}>
                            <Text style={[styles.itemName, isRejected && styles.itemNameRejected]} numberOfLines={1}>{item.name}</Text>
                            <View style={styles.itemMetaRow}>
                              <Text style={styles.itemQty}>x{item.quantity}</Text>
                              {/* Show per-item status badge when items have mixed statuses */}
                              {(order.items.length > 1 || iStatus === 'rejected') && (
                                <View style={[styles.itemStatusBadge, { backgroundColor: iConf.bg }]}>
                                  <Text style={[styles.itemStatusText, { color: iConf.color }]}>{iConf.label}</Text>
                                </View>
                              )}
                            </View>
                            {isRejected && item.refundAmount != null && item.refundAmount > 0 && (
                              <Text style={styles.refundText}>Rs. {item.refundAmount} refunded</Text>
                            )}
                          </View>
                          <Text style={[styles.itemPrice, isRejected && styles.itemPriceRejected]}>
                            {isRejected ? '' : `Rs. ${lineTotal}`}
                          </Text>
                        </View>
                      );
                    })
                  )}

                  {/* Total — show effective total (minus refunds) */}
                  {(() => {
                    const refundTotal = order.items
                      .filter(i => i.itemStatus === 'rejected' && i.refundAmount != null)
                      .reduce((sum, i) => sum + (i.refundAmount ?? 0), 0);
                    const effectiveTotal = order.total - refundTotal;

                    return (
                      <View style={styles.orderFooter}>
                        {refundTotal > 0 && (
                          <View style={styles.totalBreakdown}>
                            <View style={styles.totalBreakdownRow}>
                              <Text style={styles.breakdownLabel}>Order Total</Text>
                              <Text style={styles.breakdownValue}>Rs. {order.total}</Text>
                            </View>
                            <View style={styles.totalBreakdownRow}>
                              <Text style={styles.refundLabel}>Refunded</Text>
                              <Text style={styles.refundValue}>- Rs. {refundTotal}</Text>
                            </View>
                          </View>
                        )}
                        <View style={styles.totalRow}>
                          <Text style={styles.totalLabel}>{refundTotal > 0 ? 'Paid' : 'Total'}</Text>
                          <Text style={styles.totalValue}>Rs. {effectiveTotal > 0 ? effectiveTotal : 0}</Text>
                        </View>
                        {order.handledBy ? (
                          <View style={styles.handledByRow}>
                            <Icon name="person-circle-outline" size={13} color={colors.textSecondary} />
                            <Text style={styles.handledByText}>Delivered by {order.handledBy}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })()}
                </View>
              );
            })
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
  headerSpacer: { width: 36 },
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
  },
  filterPillActive: { backgroundColor: c.accent, borderColor: c.accent },
  filterPillText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  filterPillTextActive: { color: '#fff' },
  list: { padding: 16 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: c.card,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  emptyText: { fontSize: 14, color: c.textSecondary },

  orderCard: {
    backgroundColor: c.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: c.border, marginBottom: 12,
  },
  orderTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  orderId: { fontSize: 13, fontWeight: '600', color: c.text, flex: 1, marginRight: 8 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  dateBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 12 },
  orderDate: { fontSize: 12, color: c.textSecondary },
  serviceTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  serviceTypeBadgeText: { fontSize: 10, fontWeight: '600', color: '#8b5cf6' },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  itemIconWrap: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: c.border,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  itemImage: { width: 50, height: 50, borderRadius: 25 },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 14, fontWeight: '600', color: c.text },
  itemNameRejected: { textDecorationLine: 'line-through', color: c.textSecondary },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  itemQty: { fontSize: 12, color: c.textSecondary },
  itemStatusBadge: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 },
  itemStatusText: { fontSize: 10, fontWeight: '700' },
  refundText: { fontSize: 11, color: '#22c55e', marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: c.text },
  itemPriceRejected: { fontSize: 12, color: c.textSecondary, textDecorationLine: 'line-through' },
  itemImageRejected: { opacity: 0.4 },

  stationeryDetails: { marginBottom: 4 },
  stationeryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10,
  },
  stationeryCell: {
    flex: 1, minWidth: '40%', backgroundColor: c.surface || c.background,
    borderRadius: 10, padding: 10, borderWidth: 1, borderColor: c.border,
  },
  stationeryCellLabel: { fontSize: 11, color: c.textSecondary, marginBottom: 2 },
  stationeryCellValue: { fontSize: 14, fontWeight: '600', color: c.text },
  stationeryNote: { fontSize: 12, color: c.textSecondary, marginTop: 6, fontStyle: 'italic' },

  orderFooter: {
    marginTop: 8, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  totalBreakdown: { marginBottom: 8, gap: 4 },
  totalBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 12, color: c.textSecondary },
  breakdownValue: { fontSize: 12, color: c.textSecondary },
  refundLabel: { fontSize: 12, color: '#22c55e' },
  refundValue: { fontSize: 12, fontWeight: '600', color: '#22c55e' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 14, color: '#3b82f6' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#3b82f6' },
  handledByRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  handledByText: { fontSize: 11, color: c.textSecondary },
  bottomSpacer: { height: 40 },
});
