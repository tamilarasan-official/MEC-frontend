import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, Alert, Linking,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootState, AppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';

const SETTINGS_KEY = '@campusone_captain_settings';

export default function CaptainSettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);

  // Load saved settings
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.notifications !== undefined) setNotifications(saved.notifications);
          if (saved.sound !== undefined) setSound(saved.sound);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Save settings when they change
  const saveSettings = useCallback(async (notif: boolean, snd: boolean) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ notifications: notif, sound: snd }));
    } catch { /* ignore */ }
  }, []);

  const handleNotificationsChange = (value: boolean) => {
    setNotifications(value);
    saveSettings(value, sound);
  };

  const handleSoundChange = (value: boolean) => {
    setSound(value);
    saveSettings(notifications, value);
  };

  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = () => {
    setShowLogout(true);
  };

  const confirmLogout = () => {
    setShowLogout(false);
    dispatch(logout());
  };

  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile Section */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileRole}>Captain • {user?.shopName || 'Shop'}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
      </View>

      {/* Settings */}
      <Text style={styles.sectionTitle}>PREFERENCES</Text>

      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.blueBg }]}>
              <Icon name="notifications-outline" size={18} color={colors.blue[500]} />
            </View>
            <Text style={styles.settingLabel}>Push Notifications</Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={handleNotificationsChange}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
            accessibilityLabel="Push notifications"
            accessibilityRole="switch"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.orangeBg }]}>
              <Icon name="volume-high-outline" size={18} color={colors.orange[500]} />
            </View>
            <Text style={styles.settingLabel}>Order Sounds</Text>
          </View>
          <Switch
            value={sound}
            onValueChange={handleSoundChange}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
            accessibilityLabel="Order sounds"
            accessibilityRole="switch"
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>ACCOUNT</Text>

      <View style={styles.settingsCard}>
        <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Coming Soon', 'This feature will be available in a future update.')} accessibilityLabel="Edit profile" accessibilityRole="button">
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.successBg }]}>
              <Icon name="person-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.settingLabel}>Edit Profile</Text>
          </View>
          <Icon name="chevron-forward" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.settingRow} onPress={() => Linking.openURL('mailto:campusone@madrascollege.ac.in').catch(() => {})} accessibilityLabel="Contact Support" accessibilityRole="button">
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.warningBg }]}>
              <Icon name="call-outline" size={18} color={colors.amber[500]} />
            </View>
            <Text style={styles.settingLabel}>Contact Support</Text>
          </View>
          <Icon name="open-outline" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.settingRow} onPress={() => Linking.openURL('https://campusonesupport.madrascollege.ac.in').catch(() => {})} accessibilityLabel="Help and support" accessibilityRole="button">
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.blueBg }]}>
              <Icon name="globe-outline" size={18} color={colors.blue[500]} />
            </View>
            <Text style={styles.settingLabel}>Support Portal</Text>
          </View>
          <Icon name="open-outline" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>LEGAL</Text>

      <View style={styles.settingsCard}>
        <TouchableOpacity style={styles.settingRow} onPress={() => Linking.openURL('https://campusonesupport.madrascollege.ac.in/privacy.html').catch(() => {})} accessibilityLabel="Privacy Policy" accessibilityRole="button">
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accentBg }]}>
              <Icon name="shield-checkmark-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.settingLabel}>Privacy Policy</Text>
          </View>
          <Icon name="open-outline" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.settingRow} onPress={() => Linking.openURL('https://campusonesupport.madrascollege.ac.in/terms.html').catch(() => {})} accessibilityLabel="Terms of Service" accessibilityRole="button">
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.orangeBg }]}>
              <Icon name="document-text-outline" size={18} color={colors.orange[500]} />
            </View>
            <Text style={styles.settingLabel}>Terms & Conditions</Text>
          </View>
          <Icon name="open-outline" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7} accessibilityLabel="Logout" accessibilityRole="button">
        <Icon name="log-out-outline" size={20} color={colors.destructive} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>CampusOne</Text>
      <View style={{ height: 100 }} />
    </ScrollView>

    {/* Custom Logout Confirmation */}
    <Modal visible={showLogout} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.logoutOverlay}>
        <View style={styles.logoutDialog}>
          <View style={styles.logoutIconWrap}>
            <Icon name="log-out-outline" size={28} color={colors.destructive} />
          </View>
          <Text style={styles.logoutTitle}>Logout</Text>
          <Text style={styles.logoutMessage}>Are you sure you want to logout?</Text>
          <View style={styles.logoutActions}>
            <TouchableOpacity
              style={styles.logoutCancelBtn}
              onPress={() => setShowLogout(false)}
              activeOpacity={0.7}>
              <Text style={styles.logoutCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutConfirmBtn}
              onPress={confirmLogout}
              activeOpacity={0.7}>
              <Icon name="log-out-outline" size={16} color="#fff" />
              <Text style={styles.logoutConfirmText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { padding: 20 },
  profileCard: {
    alignItems: 'center', padding: 24, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 24,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  profileRole: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 4 },
  profileEmail: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.mutedForeground,
    letterSpacing: 1.5, marginBottom: 8,
  },
  settingsCard: {
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    marginBottom: 20, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  settingLabel: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: colors.destructive,
    marginTop: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: colors.destructive },
  version: { fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 24 },
  // Logout confirmation dialog
  logoutOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  logoutDialog: {
    width: '100%', maxWidth: 300, backgroundColor: colors.card,
    borderRadius: 20, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24,
    elevation: 16,
  },
  logoutIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(239,68,68,0.12)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  logoutTitle: {
    fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 8,
  },
  logoutMessage: {
    fontSize: 14, color: colors.mutedForeground, textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },
  logoutActions: {
    flexDirection: 'row', gap: 12, width: '100%',
  },
  logoutCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.muted, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  logoutCancelText: {
    fontSize: 14, fontWeight: '600', color: colors.foreground,
  },
  logoutConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.destructive, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  logoutConfirmText: {
    fontSize: 14, fontWeight: '600', color: '#fff',
  },
});
