import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';
import * as superadminService from '../../services/superadminService';
import { LoginSession } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type Tab = 'profile' | 'security' | 'diagnostics';

export default function SASettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAppSelector(s => s.auth.user);
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>('profile');
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await superadminService.getLoginSessions({ page: 1, limit: 20 });
      setSessions(res.sessions || []);
    } catch { } finally { setLoading(false); }
  }, []);

  const runDiagnostics = async () => {
    try {
      setLoading(true);
      const res = await superadminService.diagnoseOwnerShopLinks();
      setDiagResult(res);
    } catch { Alert.alert('Error', 'Failed to run diagnostics'); }
    finally { setLoading(false); }
  };

  const fixLinks = async () => {
    try {
      setLoading(true);
      await superadminService.linkOwnerToShop('', '');
      Alert.alert('Success', 'Links fixed successfully');
      runDiagnostics();
    } catch { Alert.alert('Error', 'Failed to fix links'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'security') loadSessions();
    if (tab === 'diagnostics') runDiagnostics();
  }, [tab, loadSessions]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'profile', label: 'Profile', icon: 'person-outline' },
    { key: 'security', label: 'Security', icon: 'shield-outline' },
    { key: 'diagnostics', label: 'Diagnostics', icon: 'build-outline' },
  ];

  const renderProfile = () => (
    <View>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'S'}</Text>
        </View>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileRole}>Super Administrator</Text>
        <Text style={styles.profileEmail}>@{user?.username}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Account Details</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Username</Text>
          <Text style={styles.infoValue}>{user?.username}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{user?.phone || 'Not set'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={styles.infoValue}>superadmin</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Icon name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSecurity = () => (
    <View>
      <Text style={styles.sectionTitle}>Login Sessions</Text>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loaderMargin} /> :
        sessions.length === 0 ? <Text style={styles.emptyText}>No sessions found</Text> :
          sessions.map(s => (
            <View key={s._id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Icon name={s.isActive ? 'ellipse' : 'ellipse-outline'} size={10} color={s.isActive ? '#10b981' : '#6b7280'} />
                <Text style={styles.sessionStatus}>{s.isActive ? 'Active' : 'Logged Out'}</Text>
              </View>
              <Text style={styles.sessionDetail}>IP: {s.ipAddress}</Text>
              <Text style={styles.sessionDetail} numberOfLines={1}>{s.userAgent}</Text>
              <Text style={styles.sessionTime}>{new Date(s.loginTime).toLocaleString()}</Text>
            </View>
          ))
      }
    </View>
  );

  const renderDiagnostics = () => (
    <View>
      <Text style={styles.sectionTitle}>System Diagnostics</Text>
      <TouchableOpacity style={styles.actionBtn} onPress={runDiagnostics}>
        <Icon name="refresh-outline" size={18} color="#fff" />
        <Text style={styles.actionBtnText}>Run Diagnostics</Text>
      </TouchableOpacity>

      {loading && !diagResult ? <ActivityIndicator color={colors.primary} style={styles.loaderMargin} /> : null}

      {diagResult && (
        <View style={styles.diagCard}>
          <Text style={styles.diagTitle}>Owner-Shop Link Status</Text>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Total Owners</Text>
            <Text style={styles.diagValue}>{diagResult.totalOwners ?? '-'}</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Linked</Text>
            <Text style={[styles.diagValue, styles.diagValueLinked]}>{diagResult.linkedOwners ?? '-'}</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Unlinked</Text>
            <Text style={[styles.diagValue, styles.diagValueUnlinked]}>{diagResult.unlinkedOwners ?? '-'}</Text>
          </View>

          {diagResult.unlinkedOwners > 0 && (
            <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={fixLinks}>
              <Icon name="hammer-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Fix Links</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.tabRow}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tabChip, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Icon name={t.icon} size={16} color={tab === t.key ? '#fff' : colors.textMuted} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'profile' && renderProfile()}
      {tab === 'security' && renderSecurity()}
      {tab === 'diagnostics' && renderDiagnostics()}
    </ScrollView>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textMuted },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  profileCard: { backgroundColor: colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 26, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 20, fontWeight: '700', color: colors.text },
  profileRole: { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: 2 },
  profileEmail: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  infoCard: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: 14, color: colors.textMuted },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fecaca' },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 20 },
  sessionCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sessionStatus: { fontSize: 13, fontWeight: '600', color: colors.text },
  sessionDetail: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  sessionTime: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'flex-start', marginBottom: 16 },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  diagCard: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  diagTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  diagRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  diagLabel: { fontSize: 14, color: colors.textMuted },
  diagValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  diagValueLinked: { color: '#10b981' },
  diagValueUnlinked: { color: '#ef4444' },
  dangerBtn: { backgroundColor: '#ef4444', marginTop: 12 },
  loaderMargin: { marginTop: 20 },
});
