import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Image, Linking,
} from 'react-native';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { setUserMode, setDietFilter } from '../../store/slices/userSlice';
import { logout } from '../../store/slices/authSlice';
import walletService from '../../services/walletService';
import { DietFilter } from '../../types';
import { resolveAvatarUrl } from '../../utils/imageUrl';

const DIET_OPTIONS: { label: string; value: DietFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Veg', value: 'veg' },
];

interface CaptainProfileDropdownProps {
  visible: boolean;
  onClose: () => void;
  onNavigateNotifications?: () => void;
}

export default function CaptainProfileDropdown({ visible, onClose, onNavigateNotifications }: CaptainProfileDropdownProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const userMode = useAppSelector(s => s.user.userMode);
  const { dietFilter } = useAppSelector(s => s.user);
  const avatarUri = resolveAvatarUrl(user?.avatarUrl);
  const roleLabel = (user?.role || 'captain').charAt(0).toUpperCase() + (user?.role || 'captain').slice(1);

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

  const [showSignOut, setShowSignOut] = useState(false);

  const handleLogout = () => {
    setShowSignOut(true);
  };

  const confirmLogout = () => {
    setShowSignOut(false);
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
                  {user?.name?.[0]?.toUpperCase() || roleLabel[0]}
                </Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || roleLabel}</Text>
              <View style={[styles.roleBadge, user?.role === 'owner' && styles.roleBadgeOwner]}>
                <Text style={[styles.roleText, user?.role === 'owner' && styles.roleTextOwner]}>{roleLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

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

          {/* Notifications */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { onClose(); onNavigateNotifications?.(); }}
            activeOpacity={0.7}>
            <Icon name="notifications-outline" size={18} color="#f97316" />
            <Text style={styles.menuItemText}>Notifications</Text>
          </TouchableOpacity>

          {/* Help & Support */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Linking.openURL('https://campusonesupport.madrascollege.ac.in').catch(() => {})}
            activeOpacity={0.7}>
            <Icon name="help-circle-outline" size={18} color={colors.accent} />
            <Text style={styles.menuItemText}>Help & Support</Text>
          </TouchableOpacity>

          {/* Privacy & Terms */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Linking.openURL('https://campusonesupport.madrascollege.ac.in/privacy.html').catch(() => {})}
            activeOpacity={0.7}>
            <Icon name="shield-checkmark-outline" size={18} color="#3b82f6" />
            <Text style={styles.menuItemText}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Linking.openURL('https://campusonesupport.madrascollege.ac.in/terms.html').catch(() => {})}
            activeOpacity={0.7}>
            <Icon name="document-text-outline" size={18} color="#f97316" />
            <Text style={styles.menuItemText}>Terms & Conditions</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Sign Out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Icon name="log-out-outline" size={18} color={colors.destructive} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>

      {/* Custom Sign Out Confirmation */}
      <Modal visible={showSignOut} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.signOutOverlay}>
          <View style={styles.signOutDialog}>
            <View style={styles.signOutIconWrap}>
              <Icon name="log-out-outline" size={28} color={colors.destructive} />
            </View>
            <Text style={styles.signOutTitle}>Sign Out</Text>
            <Text style={styles.signOutMessage}>Are you sure you want to sign out?</Text>
            <View style={styles.signOutActions}>
              <TouchableOpacity
                style={styles.signOutCancelBtn}
                onPress={() => setShowSignOut(false)}
                activeOpacity={0.7}>
                <Text style={styles.signOutCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.signOutConfirmBtn}
                onPress={confirmLogout}
                activeOpacity={0.7}>
                <Icon name="log-out-outline" size={16} color="#fff" />
                <Text style={styles.signOutConfirmText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(59,130,246,0.15)', marginTop: 4,
  },
  roleText: { fontSize: 11, fontWeight: '600', color: '#3b82f6' },
  roleBadgeOwner: { backgroundColor: 'rgba(16,185,129,0.15)' },
  roleTextOwner: { color: '#10b981' },
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
  // Sign out
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  signOutText: { fontSize: 14, fontWeight: '500', color: colors.destructive },
  // Sign out confirmation dialog
  signOutOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  signOutDialog: {
    width: '100%', maxWidth: 300, backgroundColor: colors.card,
    borderRadius: 20, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24,
    elevation: 16,
  },
  signOutIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.errorBg,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  signOutTitle: {
    fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 8,
  },
  signOutMessage: {
    fontSize: 14, color: colors.mutedForeground, textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },
  signOutActions: {
    flexDirection: 'row', gap: 12, width: '100%',
  },
  signOutCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.muted, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  signOutCancelText: {
    fontSize: 14, fontWeight: '600', color: colors.foreground,
  },
  signOutConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.destructive, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  signOutConfirmText: {
    fontSize: 14, fontWeight: '600', color: '#fff',
  },
});
