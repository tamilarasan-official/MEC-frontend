import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList,
  ActivityIndicator, Animated,
} from 'react-native';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchWalletBalance, fetchTransactions } from '../../store/slices/userSlice';
import { Transaction } from '../../types';

interface WalletModalProps {
  visible: boolean;
  onClose: () => void;
  onTopUp: () => void;
}

export default function WalletModal({ visible, onClose, onTopUp }: WalletModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const balance = useAppSelector(s => s.user.balance);
  const user = useAppSelector(s => s.auth.user);
  const transactions = useAppSelector(s => s.user.transactions);
  const [loading, setLoading] = useState(true);

  const slideAnim = useMemo(() => new Animated.Value(600), []);

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(600);
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }).start();
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        dispatch(fetchWalletBalance()),
        dispatch(fetchTransactions()),
      ]);
    } catch { /* ignore */ }
    setLoading(false);
  }, [dispatch]);

  const displayBalance = user?.balance ?? balance ?? 0;

  const handleTopUp = () => {
    onTopUp();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    }) + ', ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).toLowerCase();
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'credit' || item.type === 'refund';
    return (
      <TouchableOpacity style={styles.txCard} activeOpacity={0.7}>
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
        <View style={styles.txAmountWrap}>
          <Text style={[styles.txAmount, { color: isCredit ? '#22c55e' : '#ef4444' }]}>
            {isCredit ? '+' : '-'}Rs. {item.amount}
          </Text>
          <Icon name="chevron-forward" size={14} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={styles.kvWrapper}>
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

          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceLeft}>
              <View style={styles.balanceIcon}>
                <Icon name="wallet" size={20} color="#3b82f6" />
              </View>
              <View>
                <Text style={styles.balanceLabel}>Personal Balance</Text>
                <Text style={styles.balanceValue}>Rs. {displayBalance}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.topUpBtn} onPress={handleTopUp} activeOpacity={0.7}>
              <Icon name="add" size={14} color="#fff" />
              <Text style={styles.topUpText}>Top Up</Text>
            </TouchableOpacity>
          </View>

          {/* Transaction History */}
          <Text style={styles.sectionTitle}>Transaction History</Text>

          {loading ? (
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
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  kvWrapper: {
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
    paddingTop: 8, paddingBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  subtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },

  // Balance card
  balanceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', marginBottom: 20,
  },
  balanceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balanceIcon: {
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
  txList: { maxHeight: 380 },
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
  txAmountWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txAmount: { fontSize: 14, fontWeight: '700' },

  // Loading & empty
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyWrap: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, color: colors.mutedForeground },
});
