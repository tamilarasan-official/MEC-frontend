import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { toggleShopStatus } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';

export default function OwnerSettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const shopDetails = useSelector((s: RootState) => s.user.shopDetails);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [orderSounds, setOrderSounds] = useState(true);

  const isShopOpen = shopDetails?.isActive ?? true;

  const handleToggleShop = () => {
    dispatch(toggleShopStatus());
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || 'O')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.userName}>{user?.name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>Owner</Text>
        </View>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Shop Status */}
      <Text style={styles.sectionTitle}>SHOP</Text>
      <View style={styles.settingCard}>
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: isShopOpen ? colors.successBg : colors.errorBg }]}>
            <Icon name="storefront-outline" size={18} color={isShopOpen ? colors.primary : colors.destructive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Shop Status</Text>
            <Text style={styles.settingDesc}>{isShopOpen ? 'Open for orders' : 'Closed'}</Text>
          </View>
          <Switch
            value={isShopOpen}
            onValueChange={handleToggleShop}
            trackColor={{ false: colors.destructive, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Preferences */}
      <Text style={styles.sectionTitle}>PREFERENCES</Text>
      <View style={styles.settingCard}>
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.blueBg }]}>
            <Icon name="notifications-outline" size={18} color={colors.blue[500]} />
          </View>
          <Text style={[styles.settingLabel, { flex: 1 }]}>Push Notifications</Text>
          <Switch
            value={pushNotifs}
            onValueChange={setPushNotifs}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: 'rgba(147,51,234,0.1)' }]}>
            <Icon name="volume-high-outline" size={18} color={colors.purple[500]} />
          </View>
          <Text style={[styles.settingLabel, { flex: 1 }]}>Order Sounds</Text>
          <Switch
            value={orderSounds}
            onValueChange={setOrderSounds}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Account */}
      <Text style={styles.sectionTitle}>ACCOUNT</Text>
      <View style={styles.settingCard}>
        <TouchableOpacity style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.muted }]}>
            <Icon name="person-outline" size={18} color={colors.foreground} />
          </View>
          <Text style={[styles.settingLabel, { flex: 1 }]}>Edit Profile</Text>
          <Icon name="chevron-forward" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.muted }]}>
            <Icon name="people-outline" size={18} color={colors.foreground} />
          </View>
          <Text style={[styles.settingLabel, { flex: 1 }]}>Manage Captains</Text>
          <Icon name="chevron-forward" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.muted }]}>
            <Icon name="help-circle-outline" size={18} color={colors.foreground} />
          </View>
          <Text style={[styles.settingLabel, { flex: 1 }]}>Help & Support</Text>
          <Icon name="chevron-forward" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Icon name="log-out-outline" size={20} color={colors.destructive} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  profileCard: {
    backgroundColor: colors.card, borderRadius: 20, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, marginBottom: 20,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  userName: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  roleBadge: {
    backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 10, marginTop: 6,
  },
  roleText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  userEmail: { fontSize: 13, color: colors.mutedForeground, marginTop: 6 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.mutedForeground,
    letterSpacing: 1.5, marginBottom: 8, marginTop: 4,
  },
  settingCard: {
    backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
  },
  settingIcon: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  settingLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  settingDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.destructive,
    marginTop: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.destructive },
});
