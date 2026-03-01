import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Dimensions,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState, AppDispatch } from '../../store';
import { fetchAnalytics, fetchDashboardStats } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import OwnerHeader from '../../components/owner/OwnerHeader';
import OwnerProfileDropdown from '../../components/owner/OwnerProfileDropdown';
import OwnerWalletModal from '../../components/owner/OwnerWalletModal';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Donut Chart ───
function DonutChart({ percentage, size, strokeWidth, color, bgColor }: {
  percentage: number; size: number; strokeWidth: number; color: string; bgColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={bgColor} strokeWidth={strokeWidth} fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

// ─── Horizontal Bar Chart ───
function HBarChart({ data, colors: themeColors }: {
  data: { name: string; value: number }[];
  colors: ThemeColors;
}) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const chartWidth = SCREEN_WIDTH - 150; // account for labels + padding

  return (
    <View style={{ gap: 10 }}>
      {data.map((item, i) => {
        const barWidth = Math.max((item.value / maxValue) * chartWidth, 4);
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ width: 70, fontSize: 11, color: themeColors.mutedForeground }} numberOfLines={1}>
              {item.name.length > 10 ? item.name.substring(0, 10) + '...' : item.name}
            </Text>
            <View style={{ flex: 1, height: 24, borderRadius: 6, backgroundColor: themeColors.muted }}>
              <View style={{
                width: barWidth, height: 24, borderRadius: 6,
                backgroundColor: '#3b82f6',
              }} />
            </View>
          </View>
        );
      })}
      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', marginLeft: 78, justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 10, color: themeColors.mutedForeground }}>0</Text>
        <Text style={{ fontSize: 10, color: themeColors.mutedForeground }}>{Math.round(maxValue / 4)}</Text>
        <Text style={{ fontSize: 10, color: themeColors.mutedForeground }}>{Math.round(maxValue / 2)}</Text>
        <Text style={{ fontSize: 10, color: themeColors.mutedForeground }}>{Math.round(maxValue * 3 / 4)}</Text>
        <Text style={{ fontSize: 10, color: themeColors.mutedForeground }}>{maxValue}</Text>
      </View>
    </View>
  );
}

// ─── Vertical Bar Chart (Revenue Comparison) ───
function VBarChart({ data, colors: themeColors }: {
  data: { label: string; value: number; color: string }[];
  colors: ThemeColors;
}) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const chartHeight = 180;

  // Y-axis labels
  const yLabels = [0, 1, 2, 3, 4].map(i => Math.round((maxValue / 4) * i));
  const formatY = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`;

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* Y-axis */}
      <View style={{ width: 40, height: chartHeight, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 }}>
        {[...yLabels].reverse().map((v, i) => (
          <Text key={i} style={{ fontSize: 10, color: themeColors.mutedForeground }}>{formatY(v)}</Text>
        ))}
      </View>
      {/* Chart area */}
      <View style={{ flex: 1 }}>
        {/* Grid lines */}
        <View style={{ height: chartHeight, justifyContent: 'space-between' }}>
          {yLabels.map((_, i) => (
            <View key={i} style={{ height: 1, backgroundColor: themeColors.border, width: '100%' }} />
          ))}
        </View>
        {/* Bars */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-evenly',
          paddingHorizontal: 10,
        }}>
          {data.map((item, i) => {
            const barHeight = Math.max((item.value / maxValue) * chartHeight, 4);
            return (
              <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                <View style={{
                  width: 36, height: barHeight, borderRadius: 6,
                  backgroundColor: item.color,
                }} />
              </View>
            );
          })}
        </View>
        {/* X-axis labels */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', marginTop: 8 }}>
          {data.map((item, i) => (
            <Text key={i} style={{ fontSize: 11, color: themeColors.mutedForeground }}>{item.label}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function OwnerAnalyticsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const analytics = useSelector((s: RootState) => s.user.analytics);
  const dashboardStats = useSelector((s: RootState) => s.user.dashboardStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [salesFilter, setSalesFilter] = useState<TimeFilter>('today');
  const [ordersFilter, setOrdersFilter] = useState<TimeFilter>('month');

  const fetchData = useCallback(async () => {
    try {
      await Promise.all([
        dispatch(fetchAnalytics()),
        dispatch(fetchDashboardStats()),
      ]);
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

  // Shared header props
  const headerProps = {
    searchQuery: showSearch ? searchQuery : '',
    onSearchChange: setSearchQuery,
    showSearch,
    onToggleSearch: () => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); },
    onProfilePress: () => setShowProfile(true),
    todayRevenue: dashboardStats?.todayRevenue ?? 0,
    onRevenuePress: () => setShowWallet(true),
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <OwnerHeader {...headerProps} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
        <OwnerProfileDropdown visible={showProfile} onClose={() => setShowProfile(false)} onOpenWallet={() => setShowWallet(true)} />
        <OwnerWalletModal visible={showWallet} onClose={() => setShowWallet(false)} />
      </ScreenWrapper>
    );
  }

  if (!analytics) {
    return (
      <ScreenWrapper>
        <OwnerHeader {...headerProps} />
        <View style={styles.center}>
          <Icon name="alert-circle-outline" size={48} color={colors.destructive} />
          <Text style={styles.errorText}>Failed to load analytics</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
            <Icon name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
        <OwnerProfileDropdown visible={showProfile} onClose={() => setShowProfile(false)} onOpenWallet={() => setShowWallet(true)} />
        <OwnerWalletModal visible={showWallet} onClose={() => setShowWallet(false)} />
      </ScreenWrapper>
    );
  }

  const {
    thisMonthRevenue, thisMonthProfit, thisMonthOrders, lastMonthRevenue,
    revenueGrowth, uniqueCustomers, avgOrderValue, totalCompletedOrders,
    profitMargin, topItems,
  } = analytics;

  // Data by time filter
  const getSalesValue = (f: TimeFilter) => {
    switch (f) {
      case 'today': return dashboardStats?.todayRevenue ?? 0;
      case 'week': return Math.round(thisMonthRevenue * 0.25);
      case 'month': return thisMonthRevenue;
      case 'all': return dashboardStats?.totalRevenue ?? 0;
    }
  };
  const getSalesLabel = (f: TimeFilter) => {
    switch (f) {
      case 'today': return 'Today Revenue';
      case 'week': return 'This Week Revenue';
      case 'month': return 'This Month Revenue';
      case 'all': return 'Total Revenue';
    }
  };
  const getOrdersValue = (f: TimeFilter) => {
    switch (f) {
      case 'today': return dashboardStats?.todayOrders ?? 0;
      case 'week': return Math.round(thisMonthOrders * 0.25);
      case 'month': return thisMonthOrders;
      case 'all': return totalCompletedOrders;
    }
  };
  const getOrdersLabel = (f: TimeFilter) => {
    switch (f) {
      case 'today': return 'Today Orders';
      case 'week': return 'This Week Orders';
      case 'month': return 'Month Orders';
      case 'all': return 'Total Orders';
    }
  };

  const getMedalColor = (index: number) => {
    if (index === 0) return { bg: 'rgba(234,179,8,0.2)', text: '#eab308' };
    if (index === 1) return { bg: 'rgba(156,163,175,0.2)', text: '#9ca3af' };
    if (index === 2) return { bg: 'rgba(217,119,6,0.2)', text: '#d97706' };
    return { bg: colors.muted, text: colors.mutedForeground };
  };

  // Revenue comparison chart data (weekly breakdown approximation)
  const w4Revenue = thisMonthRevenue;
  const revenueBarData = [
    { label: 'W1', value: Math.round(lastMonthRevenue * 0.2), color: 'rgba(156,163,175,0.4)' },
    { label: 'W2', value: Math.round(lastMonthRevenue * 0.3), color: 'rgba(156,163,175,0.4)' },
    { label: 'W3', value: Math.round(lastMonthRevenue * 0.25), color: 'rgba(156,163,175,0.4)' },
    { label: 'W4', value: w4Revenue, color: '#3b82f6' },
  ];

  // Top items chart data
  const topItemsBarData = topItems.slice(0, 5).map(item => ({
    name: item.name, value: item.quantity,
  }));

  const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <ScreenWrapper>
      <OwnerHeader {...headerProps} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* ── Sales Card ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Icon name="cash-outline" size={18} color={colors.accent} />
              <Text style={styles.sectionTitle}>Sales</Text>
            </View>
            {salesFilter === 'month' && (
              <View style={[
                styles.growthBadge,
                { backgroundColor: revenueGrowth >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' },
              ]}>
                <Icon
                  name={revenueGrowth >= 0 ? 'trending-up' : 'trending-down'}
                  size={12}
                  color={revenueGrowth >= 0 ? '#10b981' : '#ef4444'}
                />
                <Text style={{
                  fontSize: 11, fontWeight: '700',
                  color: revenueGrowth >= 0 ? '#10b981' : '#ef4444',
                }}>
                  {revenueGrowth}% vs last month
                </Text>
              </View>
            )}
          </View>

          {/* Time filter tabs */}
          <View style={styles.filterRow}>
            {TIME_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterTab, salesFilter === f.key && styles.filterTabActive]}
                onPress={() => setSalesFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, salesFilter === f.key && styles.filterTabTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.bigValue}>Rs.{getSalesValue(salesFilter).toLocaleString()}</Text>
          <Text style={styles.bigLabel}>{getSalesLabel(salesFilter)}</Text>
        </View>

        {/* ── Orders Card ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardTitleRow}>
            <Icon name="checkbox-outline" size={18} color={colors.accent} />
            <Text style={styles.sectionTitle}>Orders</Text>
          </View>

          <View style={styles.filterRow}>
            {TIME_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterTab, ordersFilter === f.key && styles.filterTabActive]}
                onPress={() => setOrdersFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, ordersFilter === f.key && styles.filterTabTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.bigValue}>{getOrdersValue(ordersFilter)}</Text>
          <Text style={styles.bigLabel}>{getOrdersLabel(ordersFilter)}</Text>
        </View>

        {/* ── Avg Order Value & Unique Customers ── */}
        <View style={styles.twoColRow}>
          <View style={styles.smallCard}>
            <View style={styles.smallCardIcon}>
              <Icon name="cash-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.smallCardValue}>Rs.{avgOrderValue}</Text>
            <Text style={styles.smallCardLabel}>Avg. Order Value</Text>
          </View>
          <View style={styles.smallCard}>
            <View style={styles.smallCardIcon}>
              <Icon name="people-outline" size={18} color={colors.orange[500]} />
            </View>
            <Text style={styles.smallCardValue}>{uniqueCustomers}</Text>
            <Text style={styles.smallCardLabel}>Unique Customers</Text>
          </View>
        </View>

        {/* ── Revenue Comparison Chart ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Revenue Comparison</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'rgba(156,163,175,0.4)' }]} />
              <Text style={styles.legendText}>Last Month</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.legendText}>This Month</Text>
            </View>
          </View>
          <VBarChart data={revenueBarData} colors={colors} />
        </View>

        {/* ── Performance Metrics ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Performance Metrics</Text>
          <View style={styles.perfRow}>
            {/* Donut */}
            <View style={styles.donutWrap}>
              <DonutChart
                percentage={profitMargin}
                size={100}
                strokeWidth={12}
                color="#3b82f6"
                bgColor={colors.muted}
              />
              <View style={styles.donutCenter}>
                <Text style={styles.donutPercent}>{profitMargin}%</Text>
              </View>
            </View>
            <Text style={styles.donutLabel}>{profitMargin}% margin</Text>
            {/* Stats */}
            <View style={styles.perfStats}>
              <View style={styles.perfStatRow}>
                <Text style={styles.perfStatLabel}>This Month Revenue</Text>
                <Text style={styles.perfStatValue}>Rs.{thisMonthRevenue.toLocaleString()}</Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfStatRow}>
                <Text style={styles.perfStatLabel}>This Month Profit</Text>
                <Text style={styles.perfStatValue}>Rs.{thisMonthProfit.toLocaleString()}</Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfStatRow}>
                <Text style={styles.perfStatLabel}>Profit Margin</Text>
                <Text style={[styles.perfStatValue, { color: colors.accent }]}>{profitMargin}%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Top Selling Items ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top Selling Items</Text>
          {topItems.length === 0 ? (
            <Text style={styles.emptyText}>No sales data yet</Text>
          ) : (
            <>
              {/* Horizontal bar chart */}
              <HBarChart data={topItemsBarData} colors={colors} />

              {/* Ranked list */}
              <View style={styles.topListDivider} />
              {topItems.slice(0, 5).map((item, index) => {
                const medal = getMedalColor(index);
                return (
                  <View key={item.id || index} style={styles.topItemRow}>
                    <View style={[styles.rankBadge, { backgroundColor: medal.bg }]}>
                      <Text style={[styles.rankText, { color: medal.text }]}>{index + 1}</Text>
                    </View>
                    <View style={styles.topItemInfo}>
                      <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.topItemSold}>{item.quantity} sold</Text>
                    </View>
                    <Text style={styles.topItemRevenue}>Rs.{item.revenue.toLocaleString()}</Text>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Refresh Button */}
        <TouchableOpacity style={styles.refreshRow} onPress={onRefresh}>
          <Icon name="refresh" size={16} color={colors.mutedForeground} />
          <Text style={styles.refreshText}>Refresh Analytics</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <OwnerProfileDropdown visible={showProfile} onClose={() => setShowProfile(false)} onOpenWallet={() => setShowWallet(true)} />
      <OwnerWalletModal visible={showWallet} onClose={() => setShowWallet(false)} />
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: colors.mutedForeground },
  errorText: { fontSize: 16, fontWeight: '600', color: colors.destructive },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  retryText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Section card
  sectionCard: {
    backgroundColor: colors.card, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },

  // Growth badge
  growthBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },

  // Time filter tabs
  filterRow: {
    flexDirection: 'row', gap: 6, marginBottom: 16,
  },
  filterTab: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.muted, alignItems: 'center',
  },
  filterTabActive: { backgroundColor: '#3b82f6' },
  filterTabText: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
  filterTabTextActive: { color: '#fff' },

  // Big value
  bigValue: { fontSize: 32, fontWeight: '800', color: colors.foreground, marginBottom: 4 },
  bigLabel: { fontSize: 13, color: colors.mutedForeground },

  // Two column row
  twoColRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  smallCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  smallCardIcon: { marginBottom: 12 },
  smallCardValue: { fontSize: 22, fontWeight: '800', color: colors.foreground },
  smallCardLabel: { fontSize: 11, color: colors.mutedForeground, marginTop: 4 },

  // Legend
  legendRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.mutedForeground },

  // Performance section
  perfRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donutWrap: { position: 'relative', width: 100, height: 100 },
  donutCenter: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  donutPercent: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  donutLabel: {
    position: 'absolute', bottom: -18, left: 0, width: 100,
    textAlign: 'center', fontSize: 10, color: colors.mutedForeground,
  },
  perfStats: { flex: 1 },
  perfStatRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8,
  },
  perfStatLabel: { fontSize: 13, color: colors.mutedForeground },
  perfStatValue: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  perfDivider: { height: 1, backgroundColor: colors.border },

  // Top items
  topListDivider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  topItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rankBadge: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  rankText: { fontSize: 14, fontWeight: '800' },
  topItemInfo: { flex: 1 },
  topItemName: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  topItemSold: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  topItemRevenue: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  emptyText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 16 },

  // Refresh
  refreshRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12,
  },
  refreshText: { fontSize: 13, color: colors.mutedForeground },
});
