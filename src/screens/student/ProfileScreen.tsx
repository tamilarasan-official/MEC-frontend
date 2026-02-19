import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, DietFilter } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchWalletBalance, fetchTransactions, setDietFilter } from '../../store/slices/userSlice';
import { logout } from '../../store/slices/authSlice';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import walletService from '../../services/walletService';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Profile'>;

const DIET_OPTIONS: { label: string; value: DietFilter; icon: string; color: string }[] = [
  { label: 'Show All', value: 'all', icon: 'restaurant', color: '#3b82f6' },
  { label: 'Veg Only', value: 'veg', icon: 'leaf', color: '#22c55e' },
  { label: 'Non-Veg', value: 'nonveg', icon: 'flame', color: '#f97316' },
];

const THEME_OPTIONS = [
  { label: 'Light', icon: 'sunny-outline', value: 'light' as const },
  { label: 'Dark', icon: 'moon', value: 'dark' as const },
  { label: 'System', icon: 'desktop-outline', value: 'system' as const },
];

export default function ProfileScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const { colors, mode, setMode } = useTheme();
  const user = useAppSelector(s => s.auth.user);
  const { balance: walletBalance, transactions, dietFilter } = useAppSelector(s => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const handleDietChange = async (value: DietFilter) => {
    dispatch(setDietFilter(value));
    try {
      await walletService.updateProfile({ dietPreference: value });
    } catch { /* ignore */ }
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile & Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Icon name="person" size={32} color="#fff" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'Student'}</Text>
              <Text style={styles.profileDept}>{user?.department ? `${user.department} Department` : 'Department'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>MEC Student</Text>
              </View>
            </View>
          </View>

          {/* Info Cards Row */}
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>#</Text>
              <Text style={styles.infoLabel}>Roll Number</Text>
              <Text style={styles.infoValue}>{user?.rollNumber || 'N/A'}</Text>
            </View>
            <View style={styles.infoCard}>
              <Icon name="business-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoLabel}>Department</Text>
              <Text style={styles.infoValue}>{user?.department || 'N/A'}</Text>
            </View>
          </View>

          {/* Wallet Balance Card */}
          <TouchableOpacity
            style={styles.walletCard}
            activeOpacity={0.8}
            onPress={() => setShowTransactions(!showTransactions)}>
            <View style={styles.walletLeft}>
              <View style={styles.walletIconWrap}>
                <Icon name="wallet-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.walletLabel}>Wallet Balance</Text>
                <Text style={styles.walletAmount}>Rs. {walletBalance}</Text>
              </View>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Transactions (collapsible) */}
          {showTransactions && (
            <View style={styles.transactionsSection}>
              {transactions.length === 0 ? (
                <Text style={styles.emptyText}>No transactions yet</Text>
              ) : (
                transactions.slice(0, 15).map(tx => (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={[styles.txIcon,
                      tx.type === 'credit' || tx.type === 'refund'
                        ? styles.txIconCredit : styles.txIconDebit,
                    ]}>
                      <Icon
                        name={tx.type === 'credit' || tx.type === 'refund' ? 'arrow-down' : 'arrow-up'}
                        size={16}
                        color={tx.type === 'credit' || tx.type === 'refund' ? '#10b981' : '#ef4444'}
                      />
                    </View>
                    <View style={styles.txContent}>
                      <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                      <Text style={styles.txDate}>
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount,
                      tx.type === 'credit' || tx.type === 'refund' ? styles.txAmountCredit : styles.txAmountDebit,
                    ]}>
                      {tx.type === 'credit' || tx.type === 'refund' ? '+' : '-'}Rs.{tx.amount}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Appearance */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Icon name="moon" size={18} color={colors.accent} />
              <View>
                <Text style={styles.sectionTitle}>Appearance</Text>
                <Text style={styles.sectionSubtitle}>Choose your preferred theme</Text>
              </View>
            </View>
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.themePill, mode === opt.value && styles.themePillActive]}
                  onPress={() => setMode(opt.value)}
                  activeOpacity={0.7}>
                  <Icon
                    name={opt.icon}
                    size={16}
                    color={mode === opt.value ? '#fff' : colors.textSecondary}
                  />
                  <Text style={[styles.themePillText, mode === opt.value && styles.themePillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Diet Preference */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>🌿</Text>
              <View>
                <Text style={styles.sectionTitle}>Diet Preference</Text>
                <Text style={styles.sectionSubtitle}>Filter menu by diet type</Text>
              </View>
            </View>
            <View style={styles.themeRow}>
              {DIET_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.dietPill, dietFilter === opt.value && styles.dietPillActive]}
                  onPress={() => handleDietChange(opt.value)}
                  activeOpacity={0.7}>
                  <Icon name={opt.icon} size={16} color={opt.color} />
                  <Text style={[styles.dietPillText, dietFilter === opt.value && styles.dietPillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Menu Items */}
          {[
            { icon: 'time-outline', label: 'Order History', subtitle: 'View past completed orders', onPress: () => navigation.navigate('OrderHistory') },
            { icon: 'notifications-outline', label: 'Notifications', subtitle: 'Manage your notifications', onPress: () => navigation.navigate('NotificationSettings') },
            { icon: 'shield-checkmark-outline', label: 'Privacy & Security', subtitle: 'Account security settings', onPress: () => navigation.navigate('PrivacySecurity') },
            { icon: 'help-circle-outline', label: 'Help & Support', subtitle: 'Get help with your orders', onPress: () => navigation.navigate('HelpSupport') },
          ].map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <View style={styles.menuItemIcon}>
                  <Icon name={item.icon} size={20} color={colors.accent} />
                </View>
                <View>
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                  <Text style={styles.menuItemSub}>{item.subtitle}</Text>
                </View>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}

          {/* Sign Out */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Icon name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          {/* Version */}
          <Text style={styles.versionText}>MadrasOne v1.0.0</Text>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  content: { padding: 16 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: c.card, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: c.primaryBorder,
    marginBottom: 12,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#14b8a6',
    justifyContent: 'center', alignItems: 'center',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: c.text },
  profileDept: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
    backgroundColor: c.primaryBg, borderWidth: 1, borderColor: c.primaryBorder,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '600', color: c.primary },

  infoRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  infoCard: {
    flex: 1, backgroundColor: c.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: c.border, gap: 4,
  },
  infoIcon: { fontSize: 16, fontWeight: '700', color: c.textSecondary },
  infoLabel: { fontSize: 11, color: c.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '700', color: c.text },

  walletCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 16,
  },
  walletLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIconWrap: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: c.primaryBg,
    justifyContent: 'center', alignItems: 'center',
  },
  walletLabel: { fontSize: 12, color: c.textSecondary },
  walletAmount: { fontSize: 22, fontWeight: '800', color: c.text, marginTop: 2 },

  transactionsSection: { marginBottom: 16 },
  emptyText: { fontSize: 13, color: c.textSecondary, textAlign: 'center', paddingVertical: 20 },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border, marginBottom: 6,
  },
  txIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  txIconCredit: { backgroundColor: 'rgba(16,185,129,0.12)' },
  txIconDebit: { backgroundColor: 'rgba(239,68,68,0.12)' },
  txContent: { flex: 1 },
  txDesc: { fontSize: 13, fontWeight: '500', color: c.text },
  txDate: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txAmountCredit: { color: '#10b981' },
  txAmountDebit: { color: '#ef4444' },
  headerSpacer: { width: 36 },
  sectionEmoji: { fontSize: 18 },
  bottomSpacer: { height: 40 },

  sectionCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  sectionSubtitle: { fontSize: 12, color: c.textSecondary, marginTop: 1 },

  themeRow: { flexDirection: 'row', gap: 8 },
  themePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: c.background, borderWidth: 1, borderColor: c.border,
  },
  themePillActive: {
    backgroundColor: c.accentBg, borderColor: c.accentBorder,
  },
  themePillText: { fontSize: 12, fontWeight: '500', color: c.textSecondary },
  themePillTextActive: { color: c.accent, fontWeight: '600' },

  dietPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: c.background, borderWidth: 1, borderColor: c.border,
  },
  dietPillActive: {
    backgroundColor: c.accentBg, borderColor: c.accentBorder,
  },
  dietPillText: { fontSize: 11, fontWeight: '500', color: c.textSecondary },
  dietPillTextActive: { color: c.text, fontWeight: '600' },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 8,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: c.accentBg,
    justifyContent: 'center', alignItems: 'center',
  },
  menuItemLabel: { fontSize: 15, fontWeight: '600', color: c.text },
  menuItemSub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16, borderRadius: 14, marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: c.danger },
  versionText: { fontSize: 12, color: c.textSecondary, textAlign: 'center', marginTop: 20 },
});
