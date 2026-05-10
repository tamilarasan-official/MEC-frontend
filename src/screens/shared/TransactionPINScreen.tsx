import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Modal,
  ActivityIndicator, ScrollView, Dimensions,
} from 'react-native';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { mediumHaptic, successHaptic, errorHaptic } from '../../utils/haptics';
import { useAppSelector, useAppDispatch } from '../../store';
import { refreshUserData } from '../../store/slices/authSlice';
import api from '../../services/api';
const PIN_LENGTH = 4;
const OTP_LENGTH = 6;
const { width: SW } = Dimensions.get('window');

type Mode = 'menu' | 'change' | 'forgot';
type ChangeStep = 'current' | 'new' | 'confirm';
type ForgotStep = 'send' | 'otp' | 'newPin' | 'confirmPin';

export default function TransactionPINScreen({ navigation, onClose }: { navigation?: any; onClose?: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);

  const [mode, setMode] = useState<Mode>('menu');

  // Change PIN state
  const [changeStep, setChangeStep] = useState<ChangeStep>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeLoading, setChangeLoading] = useState(false);

  // Forgot PIN state
  const [forgotStep, setForgotStep] = useState<ForgotStep>('send');
  const [otp, setOtp] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [forgotNewPin, setForgotNewPin] = useState('');
  const [forgotConfirmPin, setForgotConfirmPin] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Success modal
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const successScale = useMemo(() => new Animated.Value(0), []);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = useCallback(() => {
    errorHaptic();
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const showSuccessModal = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    successScale.setValue(0);
    Animated.spring(successScale, {
      toValue: 1, friction: 6, tension: 80, useNativeDriver: true,
    }).start();
    successHaptic();
  }, [successScale]);

  const resetChangeState = useCallback(() => {
    setChangeStep('current');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setChangeError(null);
    setChangeLoading(false);
  }, []);

  const resetForgotState = useCallback(() => {
    setForgotStep('send');
    setOtp('');
    setOtpValue('');
    setSessionId('');
    setForgotNewPin('');
    setForgotConfirmPin('');
    setForgotError(null);
    setForgotLoading(false);
  }, []);

  const handleGoBack = useCallback(() => {
    if (mode !== 'menu') {
      resetChangeState();
      resetForgotState();
      setMode('menu');
    } else if (onClose) {
      onClose();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  }, [mode, navigation, onClose, resetChangeState, resetForgotState]);

  // ─── Current active PIN value based on mode/step ──────────────────────
  const getActivePin = (): string => {
    if (mode === 'change') {
      if (changeStep === 'current') return currentPin;
      if (changeStep === 'new') return newPin;
      return confirmPin;
    }
    if (mode === 'forgot') {
      if (forgotStep === 'otp') return otp;
      if (forgotStep === 'newPin') return forgotNewPin;
      if (forgotStep === 'confirmPin') return forgotConfirmPin;
    }
    return '';
  };

  const activePin = getActivePin();

  // ─── Change PIN Logic ─────────────────────────────────────────────────
  const handleChangePinSubmit = useCallback(async () => {
    setChangeLoading(true);
    setChangeError(null);
    try {
      await api.put('/auth/change-pin', { currentPin, newPin });
      dispatch(refreshUserData());
      resetChangeState();
      setMode('menu');
      showSuccessModal('PIN changed successfully!');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || 'Failed to change PIN.';
      setChangeError(msg);
      triggerShake();
      // Reset to current step on error
      setChangeStep('current');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } finally {
      setChangeLoading(false);
    }
  }, [currentPin, newPin, resetChangeState, showSuccessModal, triggerShake]);

  const verifyCurrentPin = useCallback(async (pin: string) => {
    setChangeLoading(true);
    setChangeError(null);
    try {
      await api.post('/auth/verify-pin', { pin });
      setChangeStep('new');
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.error?.code;
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || 'Wrong PIN. Please try again.';
      if (status === 429 || code === 'PIN_LOCKED' || code === 'PIN_COOLDOWN') {
        setChangeError(msg);
      } else {
        setChangeError(msg);
        triggerShake();
      }
      setCurrentPin('');
    } finally {
      setChangeLoading(false);
    }
  }, [triggerShake]);

  const handleChangeDigitPress = useCallback((digit: string) => {
    if (changeLoading) return;
    mediumHaptic();
    setChangeError(null);

    if (changeStep === 'current') {
      if (currentPin.length >= PIN_LENGTH) return;
      const next = currentPin + digit;
      setCurrentPin(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => verifyCurrentPin(next), 200);
      }
    } else if (changeStep === 'new') {
      if (newPin.length >= PIN_LENGTH) return;
      const next = newPin + digit;
      setNewPin(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => setChangeStep('confirm'), 200);
      }
    } else {
      if (confirmPin.length >= PIN_LENGTH) return;
      const next = confirmPin + digit;
      setConfirmPin(next);
      if (next.length === PIN_LENGTH) {
        if (next !== newPin) {
          setTimeout(() => {
            triggerShake();
            setChangeError('PINs don\'t match');
            setNewPin('');
            setConfirmPin('');
            setChangeStep('new');
          }, 200);
        } else {
          setTimeout(() => handleChangePinSubmit(), 200);
        }
      }
    }
  }, [changeStep, currentPin, newPin, confirmPin, changeLoading, handleChangePinSubmit, verifyCurrentPin, triggerShake]);

  const handleChangeBackspace = useCallback(() => {
    if (changeLoading) return;
    mediumHaptic();
    setChangeError(null);

    if (changeStep === 'current') {
      setCurrentPin(prev => prev.slice(0, -1));
    } else if (changeStep === 'new') {
      setNewPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  }, [changeStep, changeLoading]);

  // ─── Forgot PIN Logic ─────────────────────────────────────────────────
  const handleSendOtp = useCallback(async () => {
    if (!user?.phone) {
      setForgotError('Phone number not found.');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await api.post('/auth/send-otp', { phone: user.phone });
      const sid = res.data?.data?.sessionId || res.data?.sessionId || '';
      setSessionId(sid);
      setForgotStep('otp');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || 'Failed to send OTP.';
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  }, [user?.phone]);

  const handleVerifyOtp = useCallback(async (otpValue: string) => {
    // Don't verify OTP separately — store it and move to new PIN step
    // OTP will be sent with reset-pin request for server-side verification
    setOtpValue(otpValue);
    setForgotStep('newPin');
  }, []);

  const handleResetPinSubmit = useCallback(async () => {
    setForgotLoading(true);
    setForgotError(null);
    try {
      await api.post('/auth/reset-pin', { newPin: forgotNewPin, otp: otpValue, sessionId });
      dispatch(refreshUserData());
      resetForgotState();
      setMode('menu');
      showSuccessModal('PIN reset successfully!');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || 'Failed to reset PIN.';
      setForgotError(msg);
      triggerShake();
      setForgotNewPin('');
      setForgotConfirmPin('');
      setForgotStep('newPin');
    } finally {
      setForgotLoading(false);
    }
  }, [forgotNewPin, resetForgotState, showSuccessModal, triggerShake]);

  const handleForgotDigitPress = useCallback((digit: string) => {
    if (forgotLoading) return;
    mediumHaptic();
    setForgotError(null);

    if (forgotStep === 'otp') {
      if (otp.length >= OTP_LENGTH) return;
      const next = otp + digit;
      setOtp(next);
      if (next.length === OTP_LENGTH) {
        setTimeout(() => handleVerifyOtp(next), 200);
      }
    } else if (forgotStep === 'newPin') {
      if (forgotNewPin.length >= PIN_LENGTH) return;
      const next = forgotNewPin + digit;
      setForgotNewPin(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => setForgotStep('confirmPin'), 200);
      }
    } else if (forgotStep === 'confirmPin') {
      if (forgotConfirmPin.length >= PIN_LENGTH) return;
      const next = forgotConfirmPin + digit;
      setForgotConfirmPin(next);
      if (next.length === PIN_LENGTH) {
        if (next !== forgotNewPin) {
          setTimeout(() => {
            triggerShake();
            setForgotError('PINs don\'t match');
            setForgotNewPin('');
            setForgotConfirmPin('');
            setForgotStep('newPin');
          }, 200);
        } else {
          setTimeout(() => handleResetPinSubmit(), 200);
        }
      }
    }
  }, [forgotStep, otp, forgotNewPin, forgotConfirmPin, forgotLoading, handleVerifyOtp, handleResetPinSubmit, triggerShake]);

  const handleForgotBackspace = useCallback(() => {
    if (forgotLoading) return;
    mediumHaptic();
    setForgotError(null);

    if (forgotStep === 'otp') {
      setOtp(prev => prev.slice(0, -1));
    } else if (forgotStep === 'newPin') {
      setForgotNewPin(prev => prev.slice(0, -1));
    } else if (forgotStep === 'confirmPin') {
      setForgotConfirmPin(prev => prev.slice(0, -1));
    }
  }, [forgotStep, forgotLoading]);

  // ─── Get step title/subtitle ──────────────────────────────────────────
  const getStepInfo = (): { title: string; subtitle: string } => {
    if (mode === 'change') {
      switch (changeStep) {
        case 'current': return { title: 'Current PIN', subtitle: 'Enter your current 4-digit PIN' };
        case 'new': return { title: 'New PIN', subtitle: 'Enter a new 4-digit PIN' };
        case 'confirm': return { title: 'Confirm New PIN', subtitle: 'Re-enter your new PIN' };
      }
    }
    if (mode === 'forgot') {
      switch (forgotStep) {
        case 'send': return { title: 'Forgot PIN', subtitle: 'We\'ll send an OTP to your registered phone' };
        case 'otp': return { title: 'Enter OTP', subtitle: `OTP sent to ******${user?.phone?.slice(-4) || ''}` };
        case 'newPin': return { title: 'New PIN', subtitle: 'Enter a new 4-digit PIN' };
        case 'confirmPin': return { title: 'Confirm New PIN', subtitle: 'Re-enter your new PIN' };
      }
    }
    return { title: '', subtitle: '' };
  };

  // ─── Render helpers ───────────────────────────────────────────────────
  const renderPinIndicators = (pinValue: string, length: number = PIN_LENGTH) => (
    <Animated.View style={[styles.pinRow, { transform: [{ translateX: shakeAnim }] }]}>
      {Array.from({ length }, (_, i) => (
        <View
          key={i}
          style={[
            styles.pinCircle,
            length > PIN_LENGTH && styles.pinCircleSmall,
            i < pinValue.length && styles.pinCircleFilled,
          ]}
        />
      ))}
    </Animated.View>
  );

  const renderKeypad = (
    onDigit: (d: string) => void,
    onBackspace: () => void,
  ) => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'backspace'],
    ];

    return (
      <View style={styles.keypad}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key, colIndex) => {
              if (key === '') {
                return <View key={colIndex} style={styles.keypadKey} />;
              }
              if (key === 'backspace') {
                return (
                  <TouchableOpacity
                    key={colIndex}
                    style={styles.keypadKey}
                    onPress={onBackspace}
                    activeOpacity={0.6}
                    accessibilityLabel="Delete"
                    accessibilityRole="button"
                  >
                    <Icon name="backspace-outline" size={26} color={colors.foreground} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={colIndex}
                  style={styles.keypadKey}
                  onPress={() => onDigit(key)}
                  activeOpacity={0.6}
                  accessibilityLabel={`Digit ${key}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.keypadDigit}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const currentError = mode === 'change' ? changeError : forgotError;
  const currentLoading = mode === 'change' ? changeLoading : forgotLoading;
  const stepInfo = getStepInfo();

  // ─── Menu view ────────────────────────────────────────────────────────
  const renderMenu = () => (
    <ScrollView
      contentContainerStyle={styles.menuContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Change PIN card */}
      <TouchableOpacity
        style={styles.optionCard}
        onPress={() => { mediumHaptic(); setMode('change'); }}
        activeOpacity={0.7}
        accessibilityLabel="Change PIN"
        accessibilityRole="button"
      >
        <View style={[styles.optionIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
          <Icon name="key-outline" size={24} color="#10b981" />
        </View>
        <View style={styles.optionTextArea}>
          <Text style={styles.optionTitle}>Change PIN</Text>
          <Text style={styles.optionSubtitle}>
            Update your transaction PIN using your current PIN
          </Text>
        </View>
        <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Forgot PIN card */}
      <TouchableOpacity
        style={styles.optionCard}
        onPress={() => { mediumHaptic(); setMode('forgot'); }}
        activeOpacity={0.7}
        accessibilityLabel="Forgot PIN"
        accessibilityRole="button"
      >
        <View style={[styles.optionIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
          <Icon name="help-circle-outline" size={24} color={colors.accent} />
        </View>
        <View style={styles.optionTextArea}>
          <Text style={styles.optionTitle}>Forgot PIN</Text>
          <Text style={styles.optionSubtitle}>
            Reset your PIN via OTP sent to your registered phone
          </Text>
        </View>
        <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── PIN input view (change or forgot) ────────────────────────────────
  const renderPinInput = () => (
    <View style={styles.pinInputContainer}>
      {/* Step info */}
      <View style={styles.stepArea}>
        <Text style={styles.stepTitle}>{stepInfo.title}</Text>
        <Text style={styles.stepSubtitle}>{stepInfo.subtitle}</Text>
      </View>

      {/* For forgot-send step, show send OTP button instead of keypad */}
      {mode === 'forgot' && forgotStep === 'send' ? (
        <View style={styles.sendOtpArea}>
          <View style={styles.phoneInfo}>
            <Icon name="call-outline" size={20} color={colors.mutedForeground} />
            <Text style={styles.phoneText}>
              {user?.phone ? `******${user.phone.slice(-4)}` : 'No phone on file'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.sendOtpBtn, forgotLoading && styles.btnDisabled]}
            onPress={handleSendOtp}
            disabled={forgotLoading}
            activeOpacity={0.85}
            accessibilityLabel="Send OTP"
            accessibilityRole="button"
          >
            {forgotLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="send-outline" size={18} color="#fff" />
                <Text style={styles.sendOtpText}>Send OTP</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* PIN indicators */}
          {renderPinIndicators(activePin, mode === 'forgot' && forgotStep === 'otp' ? OTP_LENGTH : PIN_LENGTH)}

          {/* Error */}
          {currentError && (
            <View style={styles.errorBox}>
              <Icon name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{currentError}</Text>
            </View>
          )}

          {/* Loading */}
          {currentLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Please wait...</Text>
            </View>
          )}

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Keypad */}
          {mode === 'change'
            ? renderKeypad(handleChangeDigitPress, handleChangeBackspace)
            : renderKeypad(handleForgotDigitPress, handleForgotBackspace)
          }
        </>
      )}

      {/* Error for send step */}
      {mode === 'forgot' && forgotStep === 'send' && forgotError && (
        <View style={[styles.errorBox, { marginTop: 16 }]}>
          <Icon name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{forgotError}</Text>
        </View>
      )}
    </View>
  );

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleGoBack}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Icon name="chevron-back" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transaction PIN</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        {mode === 'menu' ? renderMenu() : renderPinInput()}
      </View>

      {/* Success Modal */}
      <Modal visible={showSuccess} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successDialog, { transform: [{ scale: successScale }] }]}>
            <View style={styles.successIconWrap}>
              <Icon name="shield-checkmark" size={32} color="#22c55e" />
            </View>
            <Text style={styles.successTitle}>{successMessage}</Text>
            <Text style={styles.successSubtitle}>
              Your transaction PIN has been updated.
            </Text>
            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => setShowSuccess(false)}
              activeOpacity={0.85}
              accessibilityLabel="Done"
              accessibilityRole="button"
            >
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  backBtn: {
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: c.foreground,
  },
  headerSpacer: { width: 36 },

  // Menu
  menuContent: {
    padding: 20,
    gap: 14,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    padding: 18,
  },
  optionIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  optionTextArea: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: c.foreground,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    color: c.mutedForeground,
    lineHeight: 18,
  },

  // PIN input container
  pinInputContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },

  // Step info
  stepArea: {
    alignItems: 'center',
    marginBottom: 28,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: c.foreground,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    color: c.mutedForeground,
    textAlign: 'center',
  },

  // PIN indicators
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  pinCircle: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2,
    borderColor: c.border,
    backgroundColor: 'transparent',
  },
  pinCircleSmall: {
    width: 36, height: 36, borderRadius: 18, marginHorizontal: 4,
  },
  pinCircleFilled: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: c.mutedForeground,
  },

  spacer: { flex: 1 },

  // Send OTP area (forgot flow)
  sendOtpArea: {
    alignItems: 'center',
    gap: 20,
    marginTop: 16,
  },
  phoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  phoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: c.foreground,
  },
  sendOtpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
  },
  btnDisabled: { opacity: 0.5 },
  sendOtpText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Keypad
  keypad: {
    paddingBottom: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  keypadKey: {
    width: (SW - 48) / 3,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  keypadDigit: {
    fontSize: 28,
    fontWeight: '600',
    color: c.foreground,
  },

  // Success modal
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successDialog: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: c.card,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  successIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: c.foreground,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: c.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#22c55e',
  },
  successBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
