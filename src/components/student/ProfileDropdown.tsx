import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Image,
} from 'react-native';

const IMAGE_BASE = 'https://backend.mec.welocalhost.com';
function resolveAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${IMAGE_BASE}${url}`;
}
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { setDietFilter } from '../../store/slices/userSlice';
import { logout } from '../../store/slices/authSlice';
import walletService from '../../services/walletService';
import { DietFilter } from '../../types';

interface ProfileDropdownProps {
  visible: boolean;
  onClose: () => void;
  onNavigateSettings?: () => void;
  onNavigateCart?: () => void;
  onNavigateNotifications?: () => void;
  onAddBalance?: () => void;
}

const DIET_OPTIONS: { label: string; value: DietFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Veg', value: 'veg' },
];

export default function ProfileDropdown({
  visible, onClose, onNavigateSettings,
  onNavigateCart, onNavigateNotifications, onAddBalance,
}: ProfileDropdownProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const { dietFilter } = useAppSelector(s => s.user);
  const cartItems = useAppSelector(s => s.cart.items);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleDietChange = async (value: DietFilter) => {
    dispatch(setDietFilter(value));
    try {
      await walletService.updateProfile({ dietPreference: value });
    } catch { /* ignore */ }
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
              {resolveAvatarUrl(user?.avatarUrl) ? (
                <Image source={{ uri: resolveAvatarUrl(user?.avatarUrl)! }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'S'}</Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Student'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {(user?.role || 'student').charAt(0).toUpperCase() + (user?.role || 'student').slice(1)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Diet Preference */}
          <View style={styles.dietSection}>
            <View style={styles.dietRow}>
              <View style={styles.dietLabelRow}>
                <Icon name="leaf-outline" size={15} color={dietFilter === 'veg' ? '#22c55e' : colors.textMuted} />
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

          {/* Cart */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { onClose(); onNavigateCart?.(); }}
            activeOpacity={0.7}>
            <View>
              <Icon name="cart-outline" size={18} color="#3b82f6" />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.menuItemText}>Cart</Text>
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { onClose(); onNavigateNotifications?.(); }}
            activeOpacity={0.7}>
            <Icon name="notifications-outline" size={18} color="#f97316" />
            <Text style={styles.menuItemText}>Notifications</Text>
          </TouchableOpacity>

          {/* Add Balance */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { onClose(); onAddBalance?.(); }}
            activeOpacity={0.7}>
            <View style={styles.addBalanceIcon}>
              <Icon name="add" size={14} color="#22c55e" />
            </View>
            <Text style={styles.menuItemText}>Add Balance</Text>
          </TouchableOpacity>

          {/* Settings */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { onClose(); onNavigateSettings?.(); }}
            activeOpacity={0.7}>
            <Icon name="settings-outline" size={18} color={colors.textMuted} />
            <Text style={styles.menuItemText}>Settings</Text>
          </TouchableOpacity>

          {/* Sign Out */}
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
            <Icon name="log-out-outline" size={18} color={colors.error} />
            <Text style={[styles.menuItemText, { color: colors.error }]}>Sign Out</Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: 56, paddingRight: 12,
  },
  dropdown: {
    width: 260, backgroundColor: colors.card, borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  userSection: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: colors.text },
  roleBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.15)', marginTop: 4,
  },
  roleText: { fontSize: 11, fontWeight: '600', color: '#3b82f6' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

  // Diet
  dietSection: { marginVertical: 2 },
  dietRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dietLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dietLabel: { fontSize: 14, fontWeight: '500', color: colors.text },
  dietButtons: { flexDirection: 'row', gap: 6 },
  dietBtn: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  dietBtnActive: { backgroundColor: colors.text, borderColor: colors.text },
  dietBtnActiveVeg: { backgroundColor: '#22c55e', borderColor: '#22c55e', flexDirection: 'row', gap: 4 },
  dietBtnText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  dietBtnTextActive: { color: colors.background },

  // Menu items
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  menuItemText: { fontSize: 14, fontWeight: '500', color: colors.text },
  addBalanceIcon: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1.5, borderColor: '#22c55e',
    justifyContent: 'center', alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute', top: -6, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
});
