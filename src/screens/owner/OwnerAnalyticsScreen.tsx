import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Dimensions, Platform, Modal,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootState, AppDispatch } from '../../store';
import { fetchAnalytics, fetchDashboardStats } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import OwnerHeader from '../../components/owner/OwnerHeader';
import OwnerProfileDropdown from '../../components/owner/OwnerProfileDropdown';
import OwnerWalletModal from '../../components/owner/OwnerWalletModal';

type TimeFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

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
  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d;
  });
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [customLoading, setCustomLoading] = useState(false);
  const [itemSalesFilter, setItemSalesFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  const fetchData = useCallback(async (startDate?: string, endDate?: string) => {
    try {
      const params = startDate && endDate ? { startDate, endDate } : undefined;
      await Promise.all([
        dispatch(fetchAnalytics(params)),
        dispatch(fetchDashboardStats()),
      ]);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useFocusEffect(useCallback(() => {
    dispatch(fetchAnalytics(undefined));
    dispatch(fetchDashboardStats());
  }, [dispatch]));

  const applyCustomRange = useCallback(async () => {
    setCustomLoading(true);
    setShowDateRangeModal(false);
    setSalesFilter('custom');
    setOrdersFilter('custom');
    const start = customStartDate.toISOString().split('T')[0];
    const end = customEndDate.toISOString().split('T')[0];
    await fetchData(start, end);
    setCustomLoading(false);
  }, [customStartDate, customEndDate, fetchData]);

  const clearCustomRange = useCallback(async () => {
    setSalesFilter('today');
    setOrdersFilter('month');
    setLoading(true);
    await fetchData();
  }, [fetchData]);

  const formatDateShort = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleDateChange = (field: 'start' | 'end') => (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(null);
    if (selectedDate) {
      if (field === 'start') setCustomStartDate(selectedDate);
      else setCustomEndDate(selectedDate);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (salesFilter === 'custom' || ordersFilter === 'custom') {
      const start = customStartDate.toISOString().split('T')[0];
      const end = customEndDate.toISOString().split('T')[0];
      await fetchData(start, end);
    } else {
      await fetchData();
    }
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
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()} accessibilityLabel="Retry loading" accessibilityRole="button">
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

  const isCustom = analytics.customRange === true;

  // Data by time filter — use real backend data
  const getSalesValue = (f: TimeFilter): number => {
    switch (f) {
      case 'today': return analytics.todaySales ?? dashboardStats?.todayRevenue ?? 0;
      case 'week': return analytics.weekSales ?? 0;
      case 'month': return thisMonthRevenue;
      case 'all': return analytics.alltimeSales ?? dashboardStats?.totalRevenue ?? 0;
      case 'custom': return analytics.customRevenue ?? thisMonthRevenue;
    }
  };
  const getSalesLabel = (f: TimeFilter): string => {
    switch (f) {
      case 'today': return 'Today Revenue';
      case 'week': return 'Last 7 Days Revenue';
      case 'month': return 'This Month Revenue';
      case 'all': return 'Total Revenue';
      case 'custom': return `${formatDateShort(customStartDate)} – ${formatDateShort(customEndDate)}`;
    }
  };
  const getOrdersValue = (f: TimeFilter): number => {
    switch (f) {
      case 'today': return analytics.todayOrders ?? dashboardStats?.todayOrders ?? 0;
      case 'week': return analytics.weekOrders ?? 0;
      case 'month': return thisMonthOrders;
      case 'all': return analytics.alltimeOrders ?? totalCompletedOrders;
      case 'custom': return analytics.customOrders ?? thisMonthOrders;
    }
  };
  const getOrdersLabel = (f: TimeFilter): string => {
    switch (f) {
      case 'today': return 'Today Orders';
      case 'week': return 'Last 7 Days Orders';
      case 'month': return 'Month Orders';
      case 'all': return 'Total Orders';
      case 'custom': return `${formatDateShort(customStartDate)} – ${formatDateShort(customEndDate)}`;
    }
  };

  type ItemSale = { name: string; quantity: number; revenue: number };
  const getItemSales = (): ItemSale[] => {
    const s = analytics?.itemSales as { today?: ItemSale[]; week?: ItemSale[]; month?: ItemSale[]; alltime?: ItemSale[] } | undefined;
    if (!s) return [];
    switch (itemSalesFilter) {
      case 'today': return s.today || [];
      case 'week':  return s.week  || [];
      case 'month': return s.month || [];
      case 'all':   return s.alltime || [];
    }
  };
  const ITEM_FILTER_LABELS: { key: 'today' | 'week' | 'month' | 'all'; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'Week'  },
    { key: 'month', label: 'Month' },
    { key: 'all',   label: 'All'   },
  ];

  const getMedalColor = (index: number) => {
    if (index === 0) return { bg: 'rgba(234,179,8,0.2)', text: '#eab308' };
    if (index === 1) return { bg: 'rgba(156,163,175,0.2)', text: '#9ca3af' };
    if (index === 2) return { bg: 'rgba(217,119,6,0.2)', text: '#d97706' };
    return { bg: colors.muted, text: colors.mutedForeground };
  };

  // Revenue comparison chart data — use real backend weekly breakdown when available
  const comparison = analytics.revenueComparison;
  const revenueBarData = comparison && comparison.length === 4
    ? comparison.map(w => ({
        label: w.week,
        value: w.thisMonth,
        color: '#3b82f6',
      }))
    : [
        { label: 'W1', value: Math.round(thisMonthRevenue * 0.2), color: '#3b82f6' },
        { label: 'W2', value: Math.round(thisMonthRevenue * 0.3), color: '#3b82f6' },
        { label: 'W3', value: Math.round(thisMonthRevenue * 0.25), color: '#3b82f6' },
        { label: 'W4', value: Math.round(thisMonthRevenue * 0.25), color: '#3b82f6' },
      ];

  // Top items — filtered by search query when active
  const filteredTopItems = searchQuery.trim()
    ? topItems.filter(item => item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : topItems;

  // Top items chart data
  const topItemsBarData = filteredTopItems.slice(0, 5).map(item => ({
    name: item.name, value: item.quantity,
  }));

  const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'all', label: 'All' },
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
        {/* ── Date Range Picker ── */}
        <View style={styles.dateRangeBar}>
          {(salesFilter === 'custom' || ordersFilter === 'custom') ? (
            <View style={styles.dateRangeActive}>
              <Icon name="calendar-outline" size={14} color={colors.accent} />
              <Text style={styles.dateRangeActiveText}>
                {formatDateShort(customStartDate)} – {formatDateShort(customEndDate)}
              </Text>
              <TouchableOpacity onPress={() => setShowDateRangeModal(true)} style={styles.dateRangeEditBtn}>
                <Icon name="create-outline" size={14} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity onPress={clearCustomRange} style={styles.dateRangeClearBtn}>
                <Icon name="close-circle" size={16} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.dateRangeBtn} onPress={() => setShowDateRangeModal(true)} activeOpacity={0.7}>
              <Icon name="calendar-outline" size={16} color={colors.accent} />
              <Text style={styles.dateRangeBtnText}>Custom Date Range</Text>
            </TouchableOpacity>
          )}
        </View>

        {customLoading && (
          <View style={styles.customLoadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.customLoadingText}>Loading custom range...</Text>
          </View>
        )}

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
                onPress={() => {
                  if (salesFilter === 'custom' && f.key !== 'custom') {
                    // Re-fetch default data when switching from custom
                    setLoading(true);
                    fetchData();
                  }
                  setSalesFilter(f.key);
                }}
                activeOpacity={0.7}
                accessibilityLabel={`${f.label} sales filter`}
                accessibilityRole="button"
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
                onPress={() => {
                  if (ordersFilter === 'custom' && f.key !== 'custom') {
                    setLoading(true);
                    fetchData();
                  }
                  setOrdersFilter(f.key);
                }}
                activeOpacity={0.7}
                accessibilityLabel={`${f.label} orders filter`}
                accessibilityRole="button"
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
        {!isCustom && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Weekly Revenue Breakdown</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                <Text style={styles.legendText}>This Month</Text>
              </View>
            </View>
            <VBarChart data={revenueBarData} colors={colors} />
          </View>
        )}

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
                <Text style={styles.perfStatLabel}>{isCustom ? 'Period Revenue' : 'This Month Revenue'}</Text>
                <Text style={styles.perfStatValue}>Rs.{(isCustom ? analytics.customRevenue ?? 0 : thisMonthRevenue).toLocaleString()}</Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfStatRow}>
                <Text style={styles.perfStatLabel}>{isCustom ? 'Period Profit' : 'This Month Profit'}</Text>
                <Text style={styles.perfStatValue}>Rs.{(isCustom ? analytics.customProfit ?? 0 : thisMonthProfit).toLocaleString()}</Text>
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
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Top Selling Items</Text>
            {searchQuery.trim() ? (
              <Text style={styles.searchResultLabel}>
                {filteredTopItems.length} result{filteredTopItems.length !== 1 ? 's' : ''} for "{searchQuery.trim()}"
              </Text>
            ) : null}
          </View>
          {topItems.length === 0 ? (
            <Text style={styles.emptyText}>No sales data yet</Text>
          ) : filteredTopItems.length === 0 ? (
            <Text style={styles.emptyText}>No items match "{searchQuery.trim()}"</Text>
          ) : (
            <>
              {/* Horizontal bar chart */}
              <HBarChart data={topItemsBarData} colors={colors} />

              {/* Ranked list */}
              <View style={styles.topListDivider} />
              {filteredTopItems.slice(0, 5).map((item, index) => {
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

        {/* ── Item Sales (Production Planning) ── */}
        {(() => {
          const items = getItemSales();
          const totalQty = items.reduce((s, i) => s + i.quantity, 0);
          const totalRev = items.reduce((s, i) => s + i.revenue, 0);
          const maxQty = items.length > 0 ? items[0].quantity : 1;
          return (
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Icon name="restaurant-outline" size={18} color={colors.accent} />
                  <Text style={styles.sectionTitle}>Item Sales</Text>
                </View>
              </View>

              {/* Time filter */}
              <View style={styles.filterRow}>
                {ITEM_FILTER_LABELS.map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterTab, itemSalesFilter === f.key && styles.filterTabActive]}
                    onPress={() => setItemSalesFilter(f.key)}
                    activeOpacity={0.7}
                    accessibilityLabel={`${f.label} item sales`}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.filterTabText, itemSalesFilter === f.key && styles.filterTabTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Summary row */}
              {items.length > 0 && (
                <View style={styles.itemSalesSummary}>
                  <View style={styles.itemSalesSummaryChip}>
                    <Icon name="layers-outline" size={13} color={colors.accent} />
                    <Text style={styles.itemSalesSummaryText}>{totalQty} plates sold</Text>
                  </View>
                  <View style={styles.itemSalesSummaryChip}>
                    <Icon name="cash-outline" size={13} color="#10b981" />
                    <Text style={[styles.itemSalesSummaryText, { color: '#10b981' }]}>Rs.{totalRev.toLocaleString()}</Text>
                  </View>
                </View>
              )}

              {/* Item list */}
              {items.length === 0 ? (
                <Text style={styles.emptyText}>No sales data for this period</Text>
              ) : (
                items.map((item, idx) => {
                  const barPct = maxQty > 0 ? item.quantity / maxQty : 0;
                  return (
                    <View key={idx} style={styles.itemSalesRow}>
                      <View style={styles.itemSalesNameRow}>
                        <Text style={styles.itemSalesName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.itemSalesQty}>{item.quantity} sold</Text>
                      </View>
                      <View style={styles.itemSalesBarTrack}>
                        <View style={[styles.itemSalesBarFill, { flex: barPct }]} />
                        <View style={{ flex: 1 - barPct }} />
                      </View>
                      <Text style={styles.itemSalesRevenue}>Rs.{item.revenue.toLocaleString()}</Text>
                    </View>
                  );
                })
              )}
            </View>
          );
        })()}

        {/* Refresh Button */}
        <TouchableOpacity style={styles.refreshRow} onPress={onRefresh} accessibilityLabel="Refresh analytics" accessibilityRole="button">
          <Icon name="refresh" size={16} color={colors.mutedForeground} />
          <Text style={styles.refreshText}>Refresh Analytics</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <OwnerProfileDropdown visible={showProfile} onClose={() => setShowProfile(false)} onOpenWallet={() => setShowWallet(true)} />
      <OwnerWalletModal visible={showWallet} onClose={() => setShowWallet(false)} />

      {/* Date Range Picker Modal */}
      <Modal visible={showDateRangeModal} transparent animationType="fade" onRequestClose={() => setShowDateRangeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.dateModal}>
            <Text style={styles.dateModalTitle}>Select Date Range</Text>

            {/* From Date */}
            <TouchableOpacity style={styles.dateField} onPress={() => setShowDatePicker(showDatePicker === 'start' ? null : 'start')}>
              <Text style={styles.dateFieldLabel}>From</Text>
              <View style={[styles.dateFieldValue, showDatePicker === 'start' && { borderColor: colors.accent }]}>
                <Icon name="calendar-outline" size={16} color={colors.accent} />
                <Text style={styles.dateFieldText}>{formatDateShort(customStartDate)}</Text>
              </View>
            </TouchableOpacity>
            {Platform.OS === 'ios' && showDatePicker === 'start' && (
              <DateTimePicker
                value={customStartDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={handleDateChange('start')}
                style={{ height: 120, marginBottom: 8 }}
              />
            )}

            {/* To Date */}
            <TouchableOpacity style={styles.dateField} onPress={() => setShowDatePicker(showDatePicker === 'end' ? null : 'end')}>
              <Text style={styles.dateFieldLabel}>To</Text>
              <View style={[styles.dateFieldValue, showDatePicker === 'end' && { borderColor: colors.accent }]}>
                <Icon name="calendar-outline" size={16} color={colors.accent} />
                <Text style={styles.dateFieldText}>{formatDateShort(customEndDate)}</Text>
              </View>
            </TouchableOpacity>
            {Platform.OS === 'ios' && showDatePicker === 'end' && (
              <DateTimePicker
                value={customEndDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={handleDateChange('end')}
                style={{ height: 120, marginBottom: 8 }}
              />
            )}

            {/* Quick presets */}
            <View style={styles.presetRow}>
              {[
                { label: 'Last 7 days', days: 7 },
                { label: 'Last 30 days', days: 30 },
                { label: 'Last 90 days', days: 90 },
              ].map(preset => (
                <TouchableOpacity
                  key={preset.days}
                  style={styles.presetBtn}
                  onPress={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - preset.days);
                    setCustomStartDate(start);
                    setCustomEndDate(end);
                  }}
                >
                  <Text style={styles.presetBtnText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions */}
            <View style={styles.dateModalActions}>
              <TouchableOpacity style={styles.dateModalCancel} onPress={() => setShowDateRangeModal(false)}>
                <Text style={styles.dateModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateModalApply, customStartDate > customEndDate && { opacity: 0.5 }]}
                onPress={applyCustomRange}
                disabled={customStartDate > customEndDate}
              >
                <Icon name="checkmark" size={16} color="#fff" />
                <Text style={styles.dateModalApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>

            {customStartDate > customEndDate && (
              <Text style={styles.dateError}>Start date must be before end date</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Android Native Date Pickers (rendered outside modal) */}
      {Platform.OS === 'android' && showDatePicker === 'start' && (
        <DateTimePicker
          value={customStartDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleDateChange('start')}
        />
      )}
      {Platform.OS === 'android' && showDatePicker === 'end' && (
        <DateTimePicker
          value={customEndDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleDateChange('end')}
        />
      )}
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
  searchResultLabel: { fontSize: 11, color: colors.mutedForeground, fontStyle: 'italic' },

  // Item sales card
  itemSalesSummary: {
    flexDirection: 'row', gap: 10, marginBottom: 14,
  },
  itemSalesSummaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.muted, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  itemSalesSummaryText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
  itemSalesRow: {
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemSalesNameRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  itemSalesName: { fontSize: 14, fontWeight: '600', color: colors.foreground, flex: 1, marginRight: 8 },
  itemSalesQty: { fontSize: 12, fontWeight: '700', color: colors.accent },
  itemSalesBarTrack: {
    flexDirection: 'row', height: 6, borderRadius: 3,
    backgroundColor: colors.muted, overflow: 'hidden', marginBottom: 5,
  },
  itemSalesBarFill: { backgroundColor: '#3b82f6', borderRadius: 3 },
  itemSalesRevenue: { fontSize: 12, color: colors.mutedForeground },

  // Refresh
  refreshRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12,
  },
  refreshText: { fontSize: 13, color: colors.mutedForeground },

  // Date range bar
  dateRangeBar: { marginBottom: 12 },
  dateRangeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  dateRangeBtnText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  dateRangeActive: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: `${colors.accent}15`, borderWidth: 1, borderColor: colors.accent,
  },
  dateRangeActiveText: { fontSize: 13, fontWeight: '600', color: colors.foreground, flex: 1 },
  dateRangeEditBtn: { padding: 4 },
  dateRangeClearBtn: { padding: 4 },
  customLoadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12,
  },
  customLoadingText: { fontSize: 12, color: colors.mutedForeground },

  // Date range modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  dateModal: {
    width: '100%', backgroundColor: colors.card, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: colors.border,
  },
  dateModalTitle: {
    fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 20, textAlign: 'center',
  },
  dateField: { marginBottom: 16 },
  dateFieldLabel: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground, marginBottom: 6 },
  dateFieldValue: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
  },
  dateFieldText: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  presetBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.muted, alignItems: 'center',
  },
  presetBtnText: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
  dateModalActions: { flexDirection: 'row', gap: 12 },
  dateModalCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.muted, alignItems: 'center',
  },
  dateModalCancelText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
  dateModalApply: {
    flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  dateModalApplyText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  dateError: { fontSize: 12, color: colors.destructive, textAlign: 'center', marginTop: 8 },
});
