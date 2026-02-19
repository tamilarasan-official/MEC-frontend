import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList } from '../../types';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import authService from '../../services/authService';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'PrivacySecurity'>;

export default function PrivacySecurityScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return 'Min 8 characters required';
    if (!/[A-Z]/.test(pw)) return 'Must contain an uppercase letter';
    if (!/[a-z]/.test(pw)) return 'Must contain a lowercase letter';
    if (!/[0-9]/.test(pw)) return 'Must contain a number';
    if (!/[^A-Za-z0-9]/.test(pw)) return 'Must contain a special character';
    return null;
  };

  const handleUpdatePassword = async () => {
    setError('');
    setSuccess('');

    if (!currentPassword) { setError('Current password is required'); return; }
    const validation = validatePassword(newPassword);
    if (validation) { setError(validation); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy & Security</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>ACCOUNT SECURITY</Text>

          {/* Change Password */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => setShowPasswordForm(!showPasswordForm)}
            activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.primaryBg }]}>
                <Icon name="lock-closed" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Change Password</Text>
                <Text style={styles.menuSub}>Update your account password</Text>
              </View>
            </View>
            <Icon name={showPasswordForm ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Password Form */}
          {showPasswordForm && (
            <View style={styles.formCard}>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              {success ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{success}</Text>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>Current Password</Text>
              <View style={styles.inputWrap}>
                <Icon name="lock-closed-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPw}
                  placeholderTextColor={colors.textSecondary}
                  placeholder="Enter current password"
                />
                <TouchableOpacity onPress={() => setShowCurrentPw(!showCurrentPw)}>
                  <Icon name={showCurrentPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.inputWrap}>
                <Icon name="lock-closed-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPw}
                  placeholderTextColor={colors.textSecondary}
                  placeholder="Enter new password"
                />
                <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)}>
                  <Icon name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.hintText}>
                Min 8 characters with uppercase, lowercase, number, and special character
              </Text>

              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={styles.inputWrap}>
                <Icon name="lock-closed-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholderTextColor={colors.textSecondary}
                  placeholder="Confirm new password"
                />
              </View>

              <TouchableOpacity
                style={[styles.updateBtn, loading && { opacity: 0.6 }]}
                onPress={handleUpdatePassword}
                disabled={loading}
                activeOpacity={0.7}>
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="shield-checkmark" size={18} color="#fff" />
                    <Text style={styles.updateBtnText}>Update Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Two-Factor Auth */}
          <View style={[styles.menuCard, { opacity: 0.7 }]}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Icon name="finger-print" size={18} color={colors.danger} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Two-Factor Authentication</Text>
                <Text style={styles.menuSub}>Add an extra layer of security</Text>
              </View>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>LEGAL</Text>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => Linking.openURL('https://madrasone.com/privacy')}
            activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.accentBg }]}>
                <Icon name="document-text" size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Privacy Policy</Text>
                <Text style={styles.menuSub}>How we handle your data</Text>
              </View>
            </View>
            <Icon name="open-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Terms of Service */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => Linking.openURL('https://madrasone.com/terms')}
            activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.primaryBg }]}>
                <Icon name="document-text" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Terms of Service</Text>
                <Text style={styles.menuSub}>Our terms and conditions</Text>
              </View>
            </View>
            <Icon name="open-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Security Notice */}
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              Your data is securely stored and encrypted. We never share your personal information with third parties without your consent.
            </Text>
          </View>

          <View style={{ height: 40 }} />
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
  content: { padding: 16 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: c.textSecondary,
    letterSpacing: 1, marginBottom: 12,
  },

  menuCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 10,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  menuIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  menuTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  menuSub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },

  comingSoonBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: c.border,
  },
  comingSoonText: { fontSize: 11, fontWeight: '600', color: c.textSecondary },

  formCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 10,
  },
  inputLabel: { fontSize: 13, fontWeight: '500', color: c.textSecondary, marginBottom: 6, marginTop: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1, borderColor: c.border,
  },
  input: { flex: 1, fontSize: 14, color: c.text, paddingVertical: 10 },
  hintText: { fontSize: 11, color: c.textSecondary, marginTop: 4, marginBottom: 4 },
  updateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, marginTop: 16,
  },
  updateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 10, marginBottom: 4,
  },
  errorText: { fontSize: 13, color: c.danger },
  successBox: {
    backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 10, padding: 10, marginBottom: 4,
  },
  successText: { fontSize: 13, color: c.primary },

  noticeCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginTop: 16,
  },
  noticeText: { fontSize: 13, color: c.textSecondary, lineHeight: 20 },
});
