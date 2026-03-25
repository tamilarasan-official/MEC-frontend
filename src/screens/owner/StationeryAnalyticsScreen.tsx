import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import OwnerHeader from '../../components/owner/OwnerHeader';
import OwnerProfileDropdown from '../../components/owner/OwnerProfileDropdown';
import OwnerWalletModal from '../../components/owner/OwnerWalletModal';
import analyticsService from '../../services/analyticsService';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

interface StationeryData {
  todaySales: number;
  weekSales: number;
  thisMonthRevenue: number;
  alltimeSales: number;
  todayOrders: number;
  weekOrders: number;
  thisMonthOrders: number;
  alltimeOrders: number;
  totalPages: number;
  totalCopies: number;
  uniqueCustomers: number;
  completionRate: number;
  colorDistribution: Array<{ type: string; count: number }>;
  paperDistribution: Array<{ size: string; count: number }>;
}

export default function StationeryAnalyticsScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();

  const [data, setData] = useState<StationeryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salesFilter, setSalesFilter] = useState<TimeFilter>('month');
  const [ordersFilter, setOrdersFilter] = useState<TimeFilter>('month');
  const [showProfile, setShowProfile] = useState(false);
  const [showWallet, setShowWallet] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const result = await analyticsService.getStationeryAnalytics();
      setData(result);
    } catch { /* silently fail */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const getSales = (filter: TimeFilter) => {
    if (!data) return 0;
    if (filter === 'today') return data.todaySales;
    if (filter === 'week') return data.weekSales;
    if (filter === 'month') return data.thisMonthRevenue;
    return data.alltimeSales;
  };

  const getOrders = (filter: TimeFilter) => {
    if (!data) return 0;
    if (filter === 'today') return data.todayOrders;
    if (filter === 'week') return data.weekOrders;
    if (filter === 'month') return data.thisMonthOrders;
    return data.alltimeOrders;
  };

  const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'all', label: 'All' },
  ];

  const totalColorOrders = data?.colorDistribution?.reduce((s, d) => s + d.count, 0) || 0;

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <OwnerHeader
        onAvatarPress={() => setShowProfile(true)}
        onWalletPress={() => setShowWallet(true)}
      />
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.title}>Stationery Analytics</Text>
          <View style={s.backBtn} />
        </View>

        {/* Revenue Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Revenue</Text>
          <View style={s.filterRow}>
            {TIME_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[s.filterBtn, salesFilter === f.key && s.filterBtnActive]}
                onPress={() => setSalesFilter(f.key)}>
                <Text style={[s.filterText, salesFilter === f.key && s.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.bigValue}>Rs. {getSales(salesFilter).toLocaleString('en-IN')}</Text>
        </View>

        {/* Orders Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Orders</Text>
          <View style={s.filterRow}>
            {TIME_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[s.filterBtn, ordersFilter === f.key && s.filterBtnActive]}
                onPress={() => setOrdersFilter(f.key)}>
                <Text style={[s.filterText, ordersFilter === f.key && s.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.bigValue}>{getOrders(ordersFilter).toLocaleString('en-IN')}</Text>
        </View>

        {/* Key Metrics */}
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Icon name="document-text-outline" size={20} color="#8b5cf6" />
            <Text style={s.metricValue}>{data?.totalPages?.toLocaleString('en-IN') || 0}</Text>
            <Text style={s.metricLabel}>Total Pages</Text>
          </View>
          <View style={s.metricCard}>
            <Icon name="copy-outline" size={20} color="#3b82f6" />
            <Text style={s.metricValue}>{data?.totalCopies?.toLocaleString('en-IN') || 0}</Text>
            <Text style={s.metricLabel}>Total Copies</Text>
          </View>
        </View>

        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Icon name="people-outline" size={20} color="#10b981" />
            <Text style={s.metricValue}>{data?.uniqueCustomers || 0}</Text>
            <Text style={s.metricLabel}>Unique Customers</Text>
          </View>
          <View style={s.metricCard}>
            <Icon name="checkmark-circle-outline" size={20} color="#f59e0b" />
            <Text style={s.metricValue}>{data?.completionRate || 0}%</Text>
            <Text style={s.metricLabel}>Completion Rate</Text>
          </View>
        </View>

        {/* Color Distribution */}
        {data?.colorDistribution && data.colorDistribution.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Color Distribution</Text>
            {data.colorDistribution.map(d => {
              const pct = totalColorOrders > 0 ? Math.round((d.count / totalColorOrders) * 100) : 0;
              const isBW = d.type === 'bw';
              return (
                <View key={d.type} style={s.distRow}>
                  <View style={s.distLabelRow}>
                    <View style={[s.distDot, { backgroundColor: isBW ? '#6b7280' : '#8b5cf6' }]} />
                    <Text style={s.distLabel}>{isBW ? 'Black & White' : 'Color'}</Text>
                    <Text style={s.distCount}>{d.count} orders</Text>
                  </View>
                  <View style={s.distBarBg}>
                    <View style={[s.distBar, { width: `${pct}%`, backgroundColor: isBW ? '#6b7280' : '#8b5cf6' }]} />
                  </View>
                  <Text style={s.distPct}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Paper Size Distribution */}
        {data?.paperDistribution && data.paperDistribution.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Paper Size</Text>
            {data.paperDistribution.map(d => {
              const totalPaper = data.paperDistribution.reduce((s, p) => s + p.count, 0);
              const pct = totalPaper > 0 ? Math.round((d.count / totalPaper) * 100) : 0;
              return (
                <View key={d.size} style={s.distRow}>
                  <View style={s.distLabelRow}>
                    <View style={[s.distDot, { backgroundColor: '#3b82f6' }]} />
                    <Text style={s.distLabel}>{d.size}</Text>
                    <Text style={s.distCount}>{d.count} orders</Text>
                  </View>
                  <View style={s.distBarBg}>
                    <View style={[s.distBar, { width: `${pct}%`, backgroundColor: '#3b82f6' }]} />
                  </View>
                  <Text style={s.distPct}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <OwnerProfileDropdown visible={showProfile} onClose={() => setShowProfile(false)} />
      <OwnerWalletModal visible={showWallet} onClose={() => setShowWallet(false)} />
    </ScreenWrapper>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: c.text },

  section: {
    backgroundColor: c.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 10 },

  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: c.surface || c.background, borderWidth: 1, borderColor: c.border,
  },
  filterBtnActive: { backgroundColor: c.accent + '20', borderColor: c.accent },
  filterText: { fontSize: 12, fontWeight: '600', color: c.textSecondary || c.textMuted },
  filterTextActive: { color: c.accent },

  bigValue: { fontSize: 28, fontWeight: '900', color: c.text },

  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  metricCard: {
    flex: 1, backgroundColor: c.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: c.border, alignItems: 'center', gap: 6,
  },
  metricValue: { fontSize: 20, fontWeight: '800', color: c.text },
  metricLabel: { fontSize: 11, color: c.textSecondary || c.textMuted, textAlign: 'center' },

  distRow: { marginBottom: 12 },
  distLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  distDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  distLabel: { fontSize: 13, fontWeight: '600', color: c.text, flex: 1 },
  distCount: { fontSize: 12, color: c.textSecondary || c.textMuted },
  distBarBg: {
    height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden', marginBottom: 2,
  },
  distBar: { height: 6, borderRadius: 3 },
  distPct: { fontSize: 11, color: c.textSecondary || c.textMuted, textAlign: 'right' },
});
