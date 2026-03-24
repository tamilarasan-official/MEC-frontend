import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Modal, Animated,
} from 'react-native';
import { mediumHaptic } from '../../utils/haptics';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import authService from '../../services/authService';

interface ChangePasswordScreenProps {
  onClose?: () => void;
}

export default function ChangePasswordScreen({ onClose, navigation }: ChangePasswordScreenProps & { navigation?: any }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const successScale = useMemo(() => new Animated.Value(0), []);

  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const submittingRef = useRef(false);

  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(newPassword);
  const isNewPasswordValid =
    newPassword.length >= 8 && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  const isFormValid =
    currentPassword.length >= 1 &&
    isNewPasswordValid &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  const getValidationMessage = () => {
    if (newPassword.length > 0 && newPassword.length < 8) {
      return 'New password must be at least 8 characters';
    }
    if (newPassword.length >= 8 && !hasUppercase) {
      return 'Must contain at least one uppercase letter';
    }
    if (newPassword.length >= 8 && !hasLowercase) {
      return 'Must contain at least one lowercase letter';
    }
    if (newPassword.length >= 8 && !hasNumber) {
      return 'Must contain at least one number';
    }
    if (newPassword.length >= 8 && !hasSpecial) {
      return 'Must contain at least one special character';
    }
    if (isNewPasswordValid && newPassword === currentPassword) {
      return 'New password must be different from current password';
    }
    if (confirmPassword.length > 0 && newPassword !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const validationMessage = getValidationMessage();

  const handleGoBack = useCallback(() => {
    if (onClose) {
      onClose();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  }, [onClose, navigation]);

  const handleChangePassword = useCallback(async () => {
    if (submittingRef.current || !isFormValid) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      mediumHaptic();
      await authService.changePassword(currentPassword, newPassword);
      setShowSuccess(true);
      successScale.setValue(0);
      Animated.spring(successScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error?.message || err?.response?.data?.message;
      let msg = 'Failed to change password. Please try again.';
      if (!err.response) {
        msg = 'Network error. Please check your connection.';
      } else if (status === 401 || status === 400) {
        msg = serverMsg || 'Current password is incorrect.';
      } else if (status === 422) {
        msg = serverMsg || 'Invalid password. Please check requirements.';
      } else if (status === 429) {
        msg = 'Too many attempts. Please try again later.';
      } else if (status >= 500) {
        msg = 'Server error. Please try again later.';
      } else if (serverMsg) {
        msg = serverMsg;
      }
      setError(msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [currentPassword, newPassword, isFormValid, handleGoBack]);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change Password</Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <Icon name="information-circle-outline" size={20} color={colors.accent} />
              <Text style={styles.infoText}>
                Enter your current password and choose a new password. Must be 8+ characters with uppercase, lowercase, number, and special character.
              </Text>
            </View>

            {/* Error */}
            {error && (
              <View style={styles.errorBox}>
                <Icon name="alert-circle" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Current Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <View style={styles.inputRow}>
                <Icon name="lock-closed-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.textInput}
                  value={currentPassword}
                  onChangeText={(val) => { setCurrentPassword(val); setError(null); }}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showCurrent}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => newPasswordRef.current?.focus()}
                  accessibilityLabel="Current password"
                />
                <TouchableOpacity
                  onPress={() => setShowCurrent(p => !p)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={showCurrent ? 'Hide current password' : 'Show current password'}>
                  <Icon name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputRow}>
                <Icon name="key-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  ref={newPasswordRef}
                  style={styles.textInput}
                  value={newPassword}
                  onChangeText={(val) => { setNewPassword(val); setError(null); }}
                  placeholder="Enter new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  accessibilityLabel="New password"
                />
                <TouchableOpacity
                  onPress={() => setShowNew(p => !p)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={showNew ? 'Hide new password' : 'Show new password'}>
                  <Icon name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputRow}>
                <Icon name="checkmark-circle-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.textInput}
                  value={confirmPassword}
                  onChangeText={(val) => { setConfirmPassword(val); setError(null); }}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => isFormValid && !loading && handleChangePassword()}
                  accessibilityLabel="Confirm new password"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm(p => !p)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}>
                  <Icon name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Validation Message */}
            {validationMessage && (
              <View style={styles.validationRow}>
                <Icon name="alert-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.validationText}>{validationMessage}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, (!isFormValid || loading) && styles.btnDisabled]}
              onPress={handleChangePassword}
              disabled={!isFormValid || loading}
              activeOpacity={0.85}
              accessibilityLabel="Change password"
              accessibilityRole="button">
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="shield-checkmark-outline" size={18} color="#fff" />
                  <Text style={styles.submitText}>Change Password</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Success Modal */}
      <Modal visible={showSuccess} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successDialog, { transform: [{ scale: successScale }] }]}>
            <View style={styles.successIconWrap}>
              <Icon name="shield-checkmark" size={32} color="#22c55e" />
            </View>
            <Text style={styles.successTitle}>Password Changed!</Text>
            <Text style={styles.successMessage}>
              Your password has been updated successfully. Use your new password next time you sign in.
            </Text>
            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => { setShowSuccess(false); handleGoBack(); }}
              activeOpacity={0.85}
              accessibilityLabel="Done"
              accessibilityRole="button">
              <Icon name="checkmark" size={18} color="#fff" />
              <Text style={styles.successBtnText}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  headerSpacer: { width: 36 },
  content: { padding: 20, gap: 16 },

  // Info card
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: c.accentBg, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: c.accentBorder,
  },
  infoText: { flex: 1, fontSize: 13, color: c.textSecondary, lineHeight: 19 },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12, padding: 12,
  },
  errorText: { flex: 1, color: '#ef4444', fontSize: 13 },

  // Input
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: c.text },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
    borderRadius: 14, paddingHorizontal: 16,
  },
  textInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: c.text },

  // Validation
  validationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  validationText: { fontSize: 12, color: c.textSecondary },

  // Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.primary, borderRadius: 14, paddingVertical: 16, marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Success modal
  successOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  successDialog: {
    width: '100%', maxWidth: 300, backgroundColor: c.card,
    borderRadius: 24, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24,
    elevation: 16,
  },
  successIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(34,197,94,0.12)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  successTitle: {
    fontSize: 20, fontWeight: '800', color: c.text, marginBottom: 8,
  },
  successMessage: {
    fontSize: 14, color: c.textMuted, textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },
  successBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#22c55e',
  },
  successBtnText: {
    fontSize: 15, fontWeight: '700', color: '#fff',
  },
});
