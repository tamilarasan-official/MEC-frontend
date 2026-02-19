import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchWalletBalance, fetchTransactions } from '../../store/slices/userSlice';
import { logout } from '../../store/slices/authSlice';
import { colors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';

export default function ProfileScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const { balance: walletBalance, transactions } = useAppSelector(s => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  useEffect(() => {
    dispatch(fetchWalletBalance());
    dispatch(fetchTransactions());
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchWalletBalance()),
      dispatch(fetchTransactions()),
    ]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <ScreenWrapper>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

      {/* Profile Header */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
        {user?.rollNumber && <Text style={styles.profileDetail}>Roll: {user.rollNumber}</Text>}
        {user?.department && <Text style={styles.profileDetail}>{user.department} • Year {user.year}</Text>}
      </View>

      {/* Wallet */}
      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <View>
            <Text style={styles.walletLabel}>Wallet Balance</Text>
            <Text style={styles.walletAmount}>Rs. {walletBalance}</Text>
          </View>
          <View style={styles.walletIconBg}>
            <Icon name="wallet-outline" size={24} color="#fff" />
          </View>
        </View>
        <TouchableOpacity
          style={styles.transactionsBtn}
          onPress={() => setShowTransactions(!showTransactions)}
          activeOpacity={0.7}>
          <Text style={styles.transactionsBtnText}>
            {showTransactions ? 'Hide' : 'View'} Transactions
          </Text>
          <Icon name={showTransactions ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Transactions */}
      {showTransactions && (
        <View style={styles.transactionsList}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>No transactions yet</Text>
          ) : (
            transactions.slice(0, 20).map(tx => (
              <View key={tx.id} style={styles.txCard}>
                <View style={[styles.txIcon, { backgroundColor: tx.type === 'credit' || tx.type === 'refund' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                  <Icon
                    name={tx.type === 'credit' || tx.type === 'refund' ? 'arrow-down' : 'arrow-up'}
                    size={18}
                    color={tx.type === 'credit' || tx.type === 'refund' ? '#10b981' : '#ef4444'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                  <Text style={styles.txDate}>
                    {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.type === 'credit' || tx.type === 'refund' ? '#10b981' : '#ef4444' }]}>
                  {tx.type === 'credit' || tx.type === 'refund' ? '+' : '-'}Rs.{tx.amount}
                </Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* Settings */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Settings</Text>
        {[
          { icon: 'person-outline', label: 'Edit Profile', onPress: () => {} },
          { icon: 'notifications-outline', label: 'Notifications', onPress: () => {} },
          { icon: 'shield-outline', label: 'Privacy', onPress: () => {} },
          { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => {} },
        ].map((item, idx) => (
          <TouchableOpacity key={idx} style={styles.settingsRow} onPress={item.onPress} activeOpacity={0.7}>
            <Icon name={item.icon} size={22} color={colors.textSecondary} />
            <Text style={styles.settingsLabel}>{item.label}</Text>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
        <Icon name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  profileCard: { alignItems: 'center', paddingVertical: 24, marginBottom: 20 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 22, fontWeight: '700', color: colors.text },
  profileEmail: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  profileDetail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  walletCard: { backgroundColor: colors.primary, borderRadius: 20, padding: 20, marginBottom: 20 },
  walletHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  walletAmount: { fontSize: 30, fontWeight: '800', color: '#fff', marginTop: 4 },
  walletIconBg: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  transactionsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  transactionsBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  transactionsList: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txDesc: { fontSize: 13, fontWeight: '500', color: colors.text },
  txDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  settingsSection: { marginBottom: 20 },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 6,
  },
  settingsLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: colors.danger },
});
