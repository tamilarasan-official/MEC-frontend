import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';
import Icon from '../../components/common/Icon';
import { colors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';

export default function CaptainSettingsScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
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
            onValueChange={setNotifications}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
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
            onValueChange={setSound}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>ACCOUNT</Text>

      <View style={styles.settingsCard}>
        <TouchableOpacity style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.successBg }]}>
              <Icon name="person-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.settingLabel}>Edit Profile</Text>
          </View>
          <Icon name="chevron-forward" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.warningBg }]}>
              <Icon name="help-circle-outline" size={18} color={colors.amber[500]} />
            </View>
            <Text style={styles.settingLabel}>Help & Support</Text>
          </View>
          <Icon name="chevron-forward" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
        <Icon name="log-out-outline" size={20} color={colors.destructive} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>MadrasOne v1.0.0</Text>
      <View style={{ height: 100 }} />
    </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
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
});
