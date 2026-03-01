import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchWalletBalance } from '../../store/slices/userSlice';
import { setUser } from '../../store/slices/authSlice';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import walletService from '../../services/walletService';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

const IMAGE_BASE = 'https://backend.mec.welocalhost.com';
function resolveAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${IMAGE_BASE}${url}`;
}

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

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    dispatch(fetchWalletBalance());
  }, [dispatch]);

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
          <LinearGradient
            colors={['rgba(16,185,129,0.12)', 'rgba(16,185,129,0.04)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.profileCard}>
            <TouchableOpacity style={styles.avatar} onPress={handleAvatarUpload} activeOpacity={0.8} disabled={avatarUploading}>
              {resolveAvatarUrl(user?.avatarUrl) && !avatarError ? (
                <Image
                  source={{ uri: `${resolveAvatarUrl(user?.avatarUrl)!}?t=${avatarTs}`, cache: 'reload' }}
                  style={styles.avatarImg}
                  resizeMode="cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <Text style={styles.avatarInitial}>{user?.name?.[0]?.toUpperCase() || 'S'}</Text>
              )}
              <View style={styles.avatarOverlay}>
                {avatarUploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Icon name="camera" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'Student'}</Text>
              <Text style={styles.profileDept}>{user?.department ? `${user.department} Department` : 'Department'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>MEC Student</Text>
              </View>
            </View>
          </LinearGradient>

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

          {/* Wallet Balance Card → navigates to WalletScreen */}
          <TouchableOpacity
            style={styles.walletCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Wallet')}>
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
                  activeOpacity={0.7}>
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
  headerSpacer: { width: 36 },
  content: { padding: 16 },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: c.primaryBorder,
    marginBottom: 12,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: '#14b8a6',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 72, height: 72, borderRadius: 20 },
  avatarInitial: { fontSize: 28, fontWeight: '800', color: '#fff' },
  avatarOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 26,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
  },
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
});
