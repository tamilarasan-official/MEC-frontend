import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';
import ScreenWrapper from '../../components/common/ScreenWrapper';

export default function AccSettingsScreen() {
  const user = useAppSelector(s => s.auth.user);
  const dispatch = useAppDispatch();
  const [notifications, setNotifications] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'A'}</Text>
        </View>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileRole}>Accountant</Text>
        <Text style={styles.profileUsername}>@{user?.username}</Text>
      </View>

      {/* Account Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Icon name="person-outline" size={18} color={colors.textMuted} />
            <Text style={styles.infoLabel}>Username</Text>
          </View>
          <Text style={styles.infoValue}>{user?.username}</Text>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Icon name="call-outline" size={18} color={colors.textMuted} />
            <Text style={styles.infoLabel}>Phone</Text>
          </View>
          <Text style={styles.infoValue}>{user?.phone || 'Not set'}</Text>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Icon name="shield-checkmark-outline" size={18} color={colors.textMuted} />
            <Text style={styles.infoLabel}>Role</Text>
          </View>
          <Text style={styles.infoValue}>Accountant</Text>
        </View>
      </View>

      {/* Notification Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.toggleRow}>
          <View style={styles.infoLeft}>
            <Icon name="notifications-outline" size={18} color={colors.textMuted} />
            <View>
              <Text style={styles.infoLabel}>Push Notifications</Text>
              <Text style={styles.infoSub}>Transaction alerts & reminders</Text>
            </View>
          </View>
          <Switch value={notifications} onValueChange={setNotifications}
            trackColor={{ false: colors.border, true: colors.primary + '60' }}
            thumbColor={notifications ? colors.primary : '#f4f3f4'} />
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.infoLeft}>
            <Icon name="mail-outline" size={18} color={colors.textMuted} />
            <View>
              <Text style={styles.infoLabel}>Email Alerts</Text>
              <Text style={styles.infoSub}>Daily summary reports</Text>
            </View>
          </View>
          <Switch value={emailAlerts} onValueChange={setEmailAlerts}
            trackColor={{ false: colors.border, true: colors.primary + '60' }}
            thumbColor={emailAlerts ? colors.primary : '#f4f3f4'} />
        </View>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Icon name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.infoLabel}>App Version</Text>
          </View>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Icon name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },
  profileCard: { backgroundColor: colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 26, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 20, fontWeight: '700', color: colors.text },
  profileRole: { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: 2 },
  profileUsername: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  section: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 14, color: colors.text },
  infoSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fecaca', marginTop: 8 },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
});
