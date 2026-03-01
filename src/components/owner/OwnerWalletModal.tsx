import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList,
  ActivityIndicator, Animated,
} from 'react-native';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import {
  fetchWalletBalance, fetchTransactions, fetchDashboardStats,
} from '../../store/slices/userSlice';
import { Transaction } from '../../types';
import TopUpModal from '../student/TopUpModal';

type WalletTab = 'eat' | 'work';

interface OwnerWalletModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: WalletTab;
}

export default function OwnerWalletModal({ visible, onClose, initialTab = 'work' }: OwnerWalletModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const balance = useAppSelector(s => s.user.balance);
  const user = useAppSelector(s => s.auth.user);
  const transactions = useAppSelector(s => s.user.transactions);
  const dashboardStats = useAppSelector(s => s.user.dashboardStats);

  const [activeTab, setActiveTab] = useState<WalletTab>(initialTab);
  const [txnLoading, setTxnLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);

  const slideAnim = useMemo(() => new Animated.Value(600), []);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      slideAnim.setValue(600);
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }).start();
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadData = useCallback(async () => {
    setTxnLoading(true);
    setStatsLoading(true);
    try {
      await Promise.all([
        dispatch(fetchWalletBalance()),
        dispatch(fetchTransactions()),
        dispatch(fetchDashboardStats()),
      ]);
    } catch { /* ignore */ }
    setTxnLoading(false);
    setStatsLoading(false);
  }, [dispatch]);

  const displayBalance = user?.balance ?? balance ?? 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    }) + ', ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).toLowerCase();
  };

  const profitMargin = dashboardStats && dashboardStats.totalRevenue > 0
    ? Math.round(((dashboardStats.totalRevenue - (dashboardStats.totalRevenue * 0.6)) / dashboardStats.totalRevenue) * 100)
    : 0;

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'credit' || item.type === 'refund';
    return (
      <View style={styles.txCard}>
        <View style={[styles.txIcon, { backgroundColor: isCredit ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }]}>
          <Icon
            name={isCredit ? 'arrow-down-outline' : 'arrow-up-outline'}
            size={18}
            color={isCredit ? '#22c55e' : '#ef4444'}
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.txDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text style={[styles.txAmount, { color: isCredit ? '#22c55e' : '#ef4444' }]}>
          {isCredit ? '+' : '-'}Rs. {item.amount}
        </Text>
      </View>
    );
  };

  const renderEatTab = () => (
    <View style={styles.tabContent}>
      {/* Balance Card */}
      <View style={styles.eatBalanceCard}>
        <View style={styles.balanceLeft}>
          <View style={styles.balanceIconWrap}>
            <Icon name="wallet" size={20} color="#3b82f6" />
          </View>
          <View>
            <Text style={styles.balanceLabel}>Personal Balance</Text>
            <Text style={styles.balanceValue}>Rs. {displayBalance}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.topUpBtn} activeOpacity={0.7} onPress={() => setShowTopUp(true)}>
          <Icon name="add" size={14} color="#fff" />
          <Text style={styles.topUpText}>Top Up</Text>
        </TouchableOpacity>
      </View>

      {/* Transaction History */}
      <Text style={styles.sectionTitle}>Transaction History</Text>

      {txnLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="receipt-outline" size={32} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.id}
          renderItem={renderTransaction}
          style={styles.txList}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const renderWorkTab = () => (
    <View style={styles.tabContent}>
      {statsLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : (
        <>
          {/* Revenue Cards 2x1 */}
          <View style={styles.revenueRow}>
            <View style={styles.revenueCardOrange}>
              <Text style={styles.revenueCardLabel}>Today's Revenue</Text>
              <Text style={styles.revenueCardValueOrange}>
                Rs. {Math.round(dashboardStats?.todayRevenue || 0)}
              </Text>
              <Text style={styles.revenueCardSub}>
                {dashboardStats?.todayOrders || 0} orders
              </Text>
            </View>
            <View style={styles.revenueCardBlue}>
              <Text style={styles.revenueCardLabel}>This Month</Text>
              <Text style={styles.revenueCardValueBlue}>
                Rs. {Math.round(dashboardStats?.totalRevenue || 0)}
              </Text>
              <Text style={styles.revenueCardSub}>
                {dashboardStats?.totalOrders || 0} orders
              </Text>
            </View>
          </View>

          {/* Profit Card */}
          <View style={styles.profitCard}>
            <View>
              <Text style={styles.profitLabel}>Monthly Profit</Text>
              <Text style={styles.profitValue}>
                Rs. {Math.round((dashboardStats?.totalRevenue || 0) * 0.4)}
              </Text>
            </View>
            {profitMargin > 0 && (
              <View style={styles.profitBadge}>
                <Text style={styles.profitBadgeText}>{profitMargin}%</Text>
              </View>
            )}
          </View>

          {/* Active Orders */}
          <Text style={styles.sectionTitle}>Active Orders</Text>
          <View style={styles.orderStatusList}>
            <View style={styles.orderStatusRow}>
              <Text style={styles.orderStatusLabel}>Pending</Text>
              <Text style={[styles.orderStatusValue, { color: '#eab308' }]}>
                {dashboardStats?.pendingCount || 0}
              </Text>
            </View>
            <View style={styles.orderStatusRow}>
              <Text style={styles.orderStatusLabel}>Preparing</Text>
              <Text style={[styles.orderStatusValue, { color: '#3b82f6' }]}>
                {dashboardStats?.preparingCount || 0}
              </Text>
            </View>
            <View style={styles.orderStatusRow}>
              <Text style={styles.orderStatusLabel}>Ready for Pickup</Text>
              <Text style={[styles.orderStatusValue, { color: '#10b981' }]}>
                {dashboardStats?.readyCount || 0}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={styles.sheetWrapper}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Drag handle */}
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Wallet</Text>
              <Text style={styles.subtitle}>Balance & transactions</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Icon name="close" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'eat' && styles.tabActiveEat]}
              onPress={() => setActiveTab('eat')}
              activeOpacity={0.7}
            >
              <Icon name="wallet" size={16} color={activeTab === 'eat' ? '#fff' : colors.mutedForeground} />
              <Text style={[styles.tabText, activeTab === 'eat' && styles.tabTextActiveEat]}>
                Eat Wallet
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'work' && styles.tabActiveWork]}
              onPress={() => setActiveTab('work')}
              activeOpacity={0.7}
            >
              <Icon name="briefcase" size={16} color={activeTab === 'work' ? '#fff' : colors.mutedForeground} />
              <Text style={[styles.tabText, activeTab === 'work' && styles.tabTextActiveWork]}>
                Work Wallet
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'eat' ? renderEatTab() : renderWorkTab()}
        </Animated.View>
      </View>

      {/* Top Up Modal */}
      <TopUpModal
        visible={showTopUp}
        onClose={() => {
          setShowTopUp(false);
          dispatch(fetchWalletBalance());
        }}
      />
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetWrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '85%',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, maxHeight: '100%',
  },
  handleBar: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: 8, paddingBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  subtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.muted,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  tabActiveEat: { backgroundColor: '#3b82f6' },
  tabTextActiveEat: { color: '#fff' },
  tabActiveWork: { backgroundColor: '#f97316' },
  tabTextActiveWork: { color: '#fff' },

  // Tab content
  tabContent: { paddingBottom: 40 },

  // Eat tab - balance card
  eatBalanceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', marginBottom: 20,
  },
  balanceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balanceIconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  balanceLabel: { fontSize: 12, color: colors.mutedForeground },
  balanceValue: { fontSize: 22, fontWeight: '800', color: '#3b82f6' },
  topUpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#3b82f6',
  },
  topUpText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Section title
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground, marginBottom: 12 },

  // Transaction list
  txList: { maxHeight: 300 },
  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    marginBottom: 8,
  },
  txIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 13, fontWeight: '500', color: colors.foreground },
  txDate: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },

  // Loading & empty
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyWrap: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, color: colors.mutedForeground },

  // Work tab - revenue cards
  revenueRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  revenueCardOrange: {
    flex: 1, padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
  },
  revenueCardBlue: {
    flex: 1, padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
  },
  revenueCardLabel: { fontSize: 11, color: colors.mutedForeground },
  revenueCardValueOrange: { fontSize: 20, fontWeight: '800', color: '#f97316', marginTop: 4 },
  revenueCardValueBlue: { fontSize: 20, fontWeight: '800', color: '#3b82f6', marginTop: 4 },
  revenueCardSub: { fontSize: 11, color: colors.mutedForeground, marginTop: 4 },

  // Profit card
  profitCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 16, marginBottom: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  profitLabel: { fontSize: 11, color: colors.mutedForeground },
  profitValue: { fontSize: 18, fontWeight: '800', color: colors.foreground, marginTop: 4 },
  profitBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  profitBadgeText: { fontSize: 14, fontWeight: '700', color: '#10b981' },

  // Order status
  orderStatusList: { gap: 8 },
  orderStatusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  orderStatusLabel: { fontSize: 13, color: colors.mutedForeground },
  orderStatusValue: { fontSize: 14, fontWeight: '700' },
});
