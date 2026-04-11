import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  Image, ActivityIndicator, Alert, Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchWalletBalance } from '../../store/slices/userSlice';
import { setUser, logout } from '../../store/slices/authSlice';
import api from '../../services/api';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import walletService from '../../services/walletService';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { resolveAvatarUrl } from '../../utils/imageUrl';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Profile'>;

const THEME_OPTIONS = [
  { label: 'Light', icon: 'sunny-outline', value: 'light' as const },
  { label: 'Dark', icon: 'moon', value: 'dark' as const },
  { label: 'System', icon: 'desktop-outline', value: 'system' as const },
];

export default function ProfileScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const { colors, mode, setMode } = useTheme();
  const user = useAppSelector(s => s.auth.user);
  const { balance: walletBalance } = useAppSelector(s => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarTs, setAvatarTs] = useState(Date.now());
  const [avatarError, setAvatarError] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    dispatch(fetchWalletBalance());
  }, [dispatch]);

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await api.delete('/auth/account');
      setShowDeleteDialog(false);
      // Wait for Modal fade-out to complete before wiping auth state — iOS freezes otherwise
      setTimeout(() => dispatch(logout()), 500);
    } catch (err: any) {
      setDeleteLoading(false);
      const msg = err?.response?.data?.error?.message || 'Failed to delete account. Please try again.';
      Alert.alert('Error', msg);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchWalletBalance());
    setRefreshing(false);
  };

  const handleAvatarUpload = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 600, maxHeight: 600 });
    if (!result.assets || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.uri) return;
    setAvatarUploading(true);
    try {
      const data = await walletService.uploadAvatar(
        asset.uri,
        asset.fileName || 'avatar.jpg',
        asset.type || 'image/jpeg',
      );
      if (user && data?.avatarUrl) {
        dispatch(setUser({ ...user, avatarUrl: data.avatarUrl }));
        setAvatarTs(Date.now());
        setAvatarError(false);
      }
    } catch {
      Alert.alert('Upload Failed', 'Could not upload profile picture. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    try {
      await walletService.updateProfile({ avatarUrl: null });
      if (user) {
        dispatch(setUser({ ...user, avatarUrl: undefined }));
        setAvatarError(false);
      }
    } catch {
      Alert.alert('Error', 'Could not remove profile picture. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarPress = () => {
    const options: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
      { text: 'Upload New Photo', onPress: handleAvatarUpload },
    ];
    if (user?.avatarUrl) {
      options.push({ text: 'Remove Photo', onPress: handleRemoveAvatar, style: 'destructive' });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile Photo', 'Choose an option', options);
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile & Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['rgba(16,185,129,0.12)', 'rgba(16,185,129,0.04)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.avatar}>
              {resolveAvatarUrl(user?.avatarUrl) && !avatarError ? (
                <Image
                  source={{ uri: `${resolveAvatarUrl(user?.avatarUrl)!}?t=${avatarTs}`, cache: 'reload' }}
                  style={styles.avatarImg}
                  resizeMode="cover"
                  onError={() => setAvatarError(true)}
                  accessibilityLabel="Profile picture"
                />
              ) : (
                <Text style={styles.avatarInitial}>{user?.name?.[0]?.toUpperCase() || 'S'}</Text>
              )}
              {/* Lock badge — profile photo managed by admin */}
              <View style={styles.avatarLockBadge}>
                <Icon name="lock-closed" size={10} color="#6b7280" />
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'Student'}</Text>
              {user?.department && (
                <Text style={styles.profileDept}>{user.department} Department</Text>
              )}
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  {user?.rollNumber ? 'MEC Student' : 'CampusOne User'}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.adminManagedText}>Profile photo is managed by admin</Text>

          {/* Info Cards Row — only for verified MEC students */}
          {user?.rollNumber && (
            <View style={styles.infoRow}>
              <View style={styles.infoCard}>
                <Text style={styles.infoIcon}>#</Text>
                <Text style={styles.infoLabel}>Roll Number</Text>
                <Text style={styles.infoValue}>{user.rollNumber}</Text>
              </View>
              <View style={styles.infoCard}>
                <Icon name="business-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Department</Text>
                <Text style={styles.infoValue}>{user?.department || 'N/A'}</Text>
              </View>
            </View>
          )}

          {/* Wallet Balance Card -> navigates to WalletScreen */}
          <TouchableOpacity
            style={styles.walletCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Wallet')}
            accessibilityLabel="Wallet balance"
            accessibilityRole="button">
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

          {/* Appearance */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Icon name="moon" size={18} color={colors.accent} />
              </View>
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
                  activeOpacity={0.7}
                  accessibilityLabel={`${opt.label} theme`}
                  accessibilityRole="button">
                  <Icon
                    name={opt.icon}
                    size={16}
                    color={mode === opt.value ? colors.accent : colors.textSecondary}
                  />
                  <Text style={[styles.themePillText, mode === opt.value && styles.themePillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Menu Items */}
          {[
            { icon: 'time-outline', label: 'Order History', subtitle: 'View past completed orders', onPress: () => navigation.navigate('OrderHistory') },
            { icon: 'lock-closed-outline', label: 'Change Password', subtitle: 'Update your account password', onPress: () => navigation.navigate('ChangePassword') },
            { icon: 'keypad-outline', label: 'Transaction PIN', subtitle: 'Change or reset your payment PIN', onPress: () => navigation.navigate('TransactionPIN' as any) },
            { icon: 'notifications-outline', label: 'Notifications', subtitle: 'Manage your notifications', onPress: () => navigation.navigate('NotificationSettings') },
            { icon: 'shield-checkmark-outline', label: 'Privacy & Security', subtitle: 'Account security settings', onPress: () => navigation.navigate('PrivacySecurity') },
            { icon: 'help-circle-outline', label: 'Help & Support', subtitle: 'Get help with your orders', onPress: () => navigation.navigate('HelpSupport') },
          ].map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
              accessibilityLabel={item.label}
              accessibilityRole="button">
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

          {/* Delete Account */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setShowDeleteDialog(true)}
            activeOpacity={0.7}
            accessibilityLabel="Delete account"
            accessibilityRole="button">
            <Icon name="trash-outline" size={20} color="#ef4444" />
            <Text style={styles.deleteBtnText}>Delete Account</Text>
          </TouchableOpacity>

          {/* Version */}
          <Text style={styles.versionText}>CampusOne</Text>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
      {/* Delete Account Modal */}
      <Modal visible={showDeleteDialog} animationType="fade" transparent statusBarTranslucent onRequestClose={() => !deleteLoading && setShowDeleteDialog(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {walletBalance > 0 ? (
              /* Blocked — has wallet balance */
              <>
                <View style={styles.modalIconWrap}>
                  <Icon name="wallet-outline" size={28} color="#f59e0b" />
                </View>
                <Text style={styles.modalTitle}>Cannot Delete Account</Text>
                <Text style={styles.modalBalanceAmount}>Rs. {walletBalance}</Text>
                <Text style={styles.modalBalanceLabel}>remaining in your wallet</Text>
                <View style={styles.modalWarningBox}>
                  <Text style={styles.modalWarningText}>
                    Please spend your wallet balance by buying food in the campus canteen before deleting your account.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalGotItBtn}
                  onPress={() => setShowDeleteDialog(false)}
                  activeOpacity={0.8}>
                  <Text style={styles.modalGotItText}>Got it</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Confirm deletion — wallet is empty */
              <>
                <View style={[styles.modalIconWrap, styles.modalIconRed]}>
                  <Icon name="trash-outline" size={28} color="#ef4444" />
                </View>
                <Text style={styles.modalTitle}>Delete Account</Text>
                <Text style={styles.modalMessage}>
                  This action is <Text style={styles.modalBold}>permanent and cannot be undone</Text>. Your profile, order history, and all associated data will be permanently deleted.
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowDeleteDialog(false)}
                    disabled={deleteLoading}
                    activeOpacity={0.7}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalDeleteBtn}
                    onPress={handleDeleteAccount}
                    disabled={deleteLoading}
                    activeOpacity={0.8}>
                    {deleteLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><Icon name="trash-outline" size={16} color="#fff" /><Text style={styles.modalDeleteText}>Delete</Text></>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  headerSpacer: { width: 36 },
  content: { padding: 16 },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, padding: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: c.primaryBorder,
    marginBottom: 12,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: '#14b8a6',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 72, height: 72, borderRadius: 20 },
  avatarInitial: { fontSize: 28, fontWeight: '800', color: '#fff' },
  avatarLockBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  adminManagedText: { fontSize: 11, color: c.textSecondary, textAlign: 'center', marginTop: -4, marginBottom: 12 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: c.text },
  profileDept: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
  },
  roleBadgeText: { fontSize: 11, fontWeight: '600', color: '#3b82f6' },

  // Info row
  infoRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  infoCard: {
    flex: 1, backgroundColor: c.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: c.border, gap: 4,
  },
  infoIcon: { fontSize: 16, fontWeight: '700', color: c.textSecondary },
  infoLabel: { fontSize: 11, color: c.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '700', color: c.text },

  // Wallet card
  walletCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.primaryBorder, marginBottom: 16,
  },
  walletLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIconWrap: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: c.primaryBg,
    justifyContent: 'center', alignItems: 'center',
  },
  walletLabel: { fontSize: 12, color: c.textSecondary },
  walletAmount: { fontSize: 22, fontWeight: '800', color: c.text, marginTop: 2 },

  // Appearance section
  sectionCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: c.accentBg,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  sectionSubtitle: { fontSize: 12, color: c.textSecondary, marginTop: 1 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: c.background, borderWidth: 1, borderColor: c.border,
  },
  themePillActive: { backgroundColor: c.accentBg, borderColor: c.accentBorder },
  themePillText: { fontSize: 12, fontWeight: '500', color: c.textSecondary },
  themePillTextActive: { color: c.accent, fontWeight: '600' },

  // Menu items
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

  versionText: { fontSize: 12, color: c.textSecondary, textAlign: 'center', marginTop: 20 },
  bottomSpacer: { height: 40 },

  // Delete account button
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: '#ef4444',
    marginTop: 8,
  },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },

  // Delete account modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  modalCard: {
    width: '100%', maxWidth: 320, backgroundColor: c.card,
    borderRadius: 28, padding: 28, alignItems: 'center',
    borderColor: c.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 16,
  },
  modalIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(245,158,11,0.12)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    borderWidth: 2, borderColor: 'rgba(245,158,11,0.2)',
  },
  modalIconRed: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.18)' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: c.text, marginBottom: 8, textAlign: 'center' },
  modalBalanceAmount: { fontSize: 32, fontWeight: '900', color: '#f59e0b', marginBottom: 2 },
  modalBalanceLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 16 },
  modalWarningBox: {
    backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: 16, padding: 16, marginBottom: 20, width: '100%',
  },
  modalWarningText: { fontSize: 13, color: '#b45309', lineHeight: 20, textAlign: 'center' },
  modalGotItBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 16,
    backgroundColor: '#f59e0b', alignItems: 'center',
  },
  modalGotItText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  modalMessage: { fontSize: 13, color: c.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalBold: { fontWeight: '700', color: c.text },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 16,
    backgroundColor: c.muted, alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: c.text },
  modalDeleteBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 16,
    backgroundColor: '#dc2626', alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  modalDeleteText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
