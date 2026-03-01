import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Image, Switch,
} from 'react-native';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { setUserMode, setDietFilter, toggleShopStatus } from '../../store/slices/userSlice';
import { logout } from '../../store/slices/authSlice';
import walletService from '../../services/walletService';
import { DietFilter } from '../../types';

const IMAGE_BASE = 'https://backend.mec.welocalhost.com';
function resolveAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${IMAGE_BASE}${url}`;
}

const DIET_OPTIONS: { label: string; value: DietFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Veg', value: 'veg' },
];

interface OwnerProfileDropdownProps {
  visible: boolean;
  onClose: () => void;
  onNavigateNotifications?: () => void;
  onOpenWallet?: () => void;
}

export default function OwnerProfileDropdown({ visible, onClose, onNavigateNotifications, onOpenWallet }: OwnerProfileDropdownProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const userMode = useAppSelector(s => s.user.userMode);
  const { dietFilter } = useAppSelector(s => s.user);
  const shopDetails = useAppSelector(s => s.user.shopDetails);
  const balance = useAppSelector(s => s.user.balance);
  const avatarUri = resolveAvatarUrl(user?.avatarUrl);
  const isShopOpen = shopDetails?.isActive ?? true;
  const displayBalance = user?.balance ?? balance ?? 0;

  const handleDietChange = async (value: DietFilter) => {
    dispatch(setDietFilter(value));
    try {
      await walletService.updateProfile({ dietPreference: value });
    } catch { /* ignore */ }
  };

  const handleModeChange = (mode: 'eat' | 'work') => {
    dispatch(setUserMode(mode));
    onClose();
  };

  const handleToggleShop = () => {
    dispatch(toggleShopStatus());
  };

  const handleLogout = () => {
    onClose();
    dispatch(logout());
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.dropdown}>

          {/* User Info */}
          <View style={styles.userSection}>
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>
                  {user?.name?.[0]?.toUpperCase() || 'O'}
                </Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Owner'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>Owner</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Mode Toggle */}
          <View style={styles.modeSection}>
            <View style={styles.modeLabelRow}>
              <Icon name="restaurant" size={14} color={colors.accent} />
              <Text style={styles.modeLabel}>Mode</Text>
            </View>
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, userMode === 'eat' && styles.modeBtnActive]}
                onPress={() => handleModeChange('eat')}
                activeOpacity={0.7}
              >
                <Icon name="restaurant" size={14} color={userMode === 'eat' ? '#fff' : colors.mutedForeground} />
                <Text style={[styles.modeBtnText, userMode === 'eat' && styles.modeBtnTextActive]}>Eat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, userMode === 'work' && styles.modeBtnActive]}
                onPress={() => handleModeChange('work')}
                activeOpacity={0.7}
              >
                <Icon name="briefcase-outline" size={14} color={userMode === 'work' ? '#fff' : colors.mutedForeground} />
                <Text style={[styles.modeBtnText, userMode === 'work' && styles.modeBtnTextActive]}>Work</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Shop Status Toggle (work mode only) */}
          {userMode === 'work' && (
            <>
              <View style={styles.shopSection}>
                <View style={styles.shopLabelRow}>
                  <Icon name="storefront-outline" size={15} color={isShopOpen ? '#22c55e' : colors.destructive} />
                  <Text style={styles.shopLabel}>Shop {isShopOpen ? 'Open' : 'Closed'}</Text>
                </View>
                <Switch
                  value={isShopOpen}
                  onValueChange={handleToggleShop}
                  trackColor={{ false: colors.destructive, true: '#22c55e' }}
                  thumbColor="#fff"
                  style={{ transform: [{ scale: 0.85 }] }}
                />
              </View>
              <View style={styles.divider} />
            </>
          )}

          {/* Diet Preference (eat mode only) */}
          {userMode === 'eat' && (
            <>
              <View style={styles.dietSection}>
                <View style={styles.dietRow}>
                  <View style={styles.dietLabelRow}>
                    <Icon name="leaf-outline" size={15} color={dietFilter === 'veg' ? '#22c55e' : colors.mutedForeground} />
                    <Text style={styles.dietLabel}>Diet</Text>
                  </View>
                  <View style={styles.dietButtons}>
                    {DIET_OPTIONS.map(opt => {
                      const isActive = dietFilter === opt.value;
                      const isVeg = opt.value === 'veg';
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.dietBtn,
                            isActive && (isVeg ? styles.dietBtnActiveVeg : styles.dietBtnActive),
                          ]}
                          onPress={() => handleDietChange(opt.value)}
                          activeOpacity={0.7}>
                          {isVeg && isActive && (
                            <Icon name="leaf" size={12} color="#fff" />
                          )}
                          <Text style={[styles.dietBtnText, isActive && styles.dietBtnTextActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
              <View style={styles.divider} />
            </>
          )}

          {/* Notifications (eat mode only) */}
          {userMode === 'eat' && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { onClose(); onNavigateNotifications?.(); }}
              activeOpacity={0.7}>
              <Icon name="notifications-outline" size={18} color="#f97316" />
              <Text style={styles.menuItemText}>Notifications</Text>
            </TouchableOpacity>
          )}

          {/* Wallet */}
          <TouchableOpacity
            style={styles.walletRow}
            onPress={() => { onClose(); onOpenWallet?.(); }}
            activeOpacity={0.7}>
            <View style={styles.walletLeft}>
              <View style={styles.walletIconWrap}>
                <Icon name="wallet" size={16} color="#3b82f6" />
              </View>
              <View>
                <Text style={styles.walletLabel}>Wallet</Text>
                <Text style={styles.walletBalance}>Rs. {displayBalance}</Text>
              </View>
            </View>
            <Icon name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Sign Out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Icon name="log-out-outline" size={18} color={colors.destructive} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: 56, paddingRight: 12,
  },
  dropdown: {
    width: 240, backgroundColor: colors.card, borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20,
    elevation: 12, borderWidth: 1, borderColor: colors.border,
  },
  userSection: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  roleBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.15)', marginTop: 4,
  },
  roleText: { fontSize: 11, fontWeight: '600', color: '#10b981' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  // Mode toggle
  modeSection: { marginVertical: 2 },
  modeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  modeLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  modeToggle: {
    flexDirection: 'row', backgroundColor: colors.muted,
    borderRadius: 12, padding: 3, gap: 3,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: 10,
  },
  modeBtnActive: {
    backgroundColor: colors.accent,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    elevation: 3,
  },
  modeBtnText: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
  modeBtnTextActive: { color: '#fff' },
  // Shop status
  shopSection: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginVertical: 2,
  },
  shopLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shopLabel: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  // Diet
  dietSection: { marginVertical: 2 },
  dietRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dietLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dietLabel: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  dietButtons: { flexDirection: 'row', gap: 6 },
  dietBtn: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, alignItems: 'center',
    backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
  },
  dietBtnActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  dietBtnActiveVeg: { backgroundColor: '#22c55e', borderColor: '#22c55e', flexDirection: 'row', gap: 4 },
  dietBtnText: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
  dietBtnTextActive: { color: colors.card },
  // Menu items
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  menuItemText: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  // Wallet
  walletRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10,
  },
  walletLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  walletIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  walletLabel: { fontSize: 13, fontWeight: '500', color: colors.mutedForeground },
  walletBalance: { fontSize: 15, fontWeight: '700', color: '#3b82f6', marginTop: 1 },
  // Sign out
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  signOutText: { fontSize: 14, fontWeight: '500', color: colors.destructive },
});
