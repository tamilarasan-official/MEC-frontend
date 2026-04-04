import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
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
  onTransactionPress?: (transaction: Transaction) => void;
}

export default function WalletModal({ visible, onClose, onTopUp, onTransactionPress }: WalletModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const balance = useAppSelector(s => s.user.balance);
  const user = useAppSelector(s => s.auth.user);
  const transactions = useAppSelector(s => s.user.transactions);
  const [loading, setLoading] = useState(true);

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['55%', '95%'], []);
  const pendingActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleDismiss = useCallback(() => {
    onClose();
    if (pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      action();
    }
  }, [onClose]);

  const dismissAndThen = useCallback((action: () => void) => {
    pendingActionRef.current = action;
    bottomSheetRef.current?.dismiss();
  }, []);

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

  const displayBalance = balance ?? user?.balance ?? 0;

  const handleTopUp = useCallback(() => {
    dismissAndThen(() => onTopUp());
  }, [dismissAndThen, onTopUp]);

  const handleTransactionPress = useCallback((item: Transaction) => {
    if (onTransactionPress) {
      dismissAndThen(() => onTransactionPress(item));
    }
  }, [dismissAndThen, onTransactionPress]);

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    }) + ', ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).toLowerCase();
  };

  const renderTransaction = useCallback(({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'credit' || item.type === 'refund';
    return (
      <TouchableOpacity
        style={styles.txCard}
        activeOpacity={0.7}
        onPress={onTransactionPress ? () => handleTransactionPress(item) : undefined}
      >
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styles, colors, handleTransactionPress, onTransactionPress]);

  const WalletHeader = useMemo(() => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Wallet</Text>
          <Text style={styles.subtitle}>Balance & transactions</Text>
        </View>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
          <Icon name="close" size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Balance card */}
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
      <Text style={styles.sectionTitle}>Transaction History</Text>
    </>
  ), [styles, colors, displayBalance, handleTopUp, handleClose]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
    >
      {loading ? (
        <BottomSheetView style={styles.emptyContainer}>
          {WalletHeader}
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        </BottomSheetView>
      ) : transactions.length === 0 ? (
        <BottomSheetView style={styles.emptyContainer}>
          {WalletHeader}
          <View style={styles.emptyWrap}>
            <Icon name="receipt-outline" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        </BottomSheetView>
      ) : (
        <BottomSheetFlatList
          data={transactions}
          keyExtractor={(item: Transaction) => item.id}
          renderItem={renderTransaction}
          ListHeaderComponent={WalletHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </BottomSheetModal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
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
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', marginBottom: 16,
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

  // List
  listContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 },
  emptyContainer: { paddingHorizontal: 20, paddingTop: 4 },

  // Transaction card
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
  loadingWrap: { flex: 1, paddingVertical: 40, alignItems: 'center' },
  emptyWrap: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, color: colors.mutedForeground },
});
