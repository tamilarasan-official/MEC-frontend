import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
} from 'react-native';
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
}

const DIET_OPTIONS: { label: string; value: DietFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Veg', value: 'veg' },
  { label: 'Non-Veg', value: 'nonveg' },
];

export default function ProfileDropdown({ visible, onClose, onNavigateSettings }: ProfileDropdownProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const { dietFilter } = useAppSelector(s => s.user);

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
              <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'S'}</Text>
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
            <View style={styles.dietHeader}>
              <Icon name="leaf-outline" size={16} color={colors.primary} />
              <Text style={styles.dietLabel}>Diet Preference</Text>
            </View>
            <View style={styles.dietButtons}>
              {DIET_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.dietBtn, dietFilter === opt.value && styles.dietBtnActive]}
                  onPress={() => handleDietChange(opt.value)}
                  activeOpacity={0.7}>
                  <Text style={[styles.dietBtnText, dietFilter === opt.value && styles.dietBtnTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

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
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: 60, paddingRight: 12,
  },
  dropdown: {
    width: 250, backgroundColor: colors.background, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  userSection: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: colors.text },
  roleBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    backgroundColor: colors.surface, marginTop: 2,
  },
  roleText: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  dietSection: { marginBottom: 4 },
  dietHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  dietLabel: { fontSize: 13, fontWeight: '500', color: colors.text },
  dietButtons: { flexDirection: 'row', gap: 6 },
  dietBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  dietBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dietBtnText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  dietBtnTextActive: { color: '#fff' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  menuItemText: { fontSize: 14, fontWeight: '500', color: colors.text },
});
