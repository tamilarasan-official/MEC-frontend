import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
  Image,
} from 'react-native';
import { mediumHaptic, successHaptic } from '../../utils/haptics';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { sendOtp, registerWithOtp, clearError } from '../../store/slices/authSlice';
import Icon from '../../components/common/Icon';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function RegisterScreen({ navigation }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const submittingRef = useRef(false);

  const dispatch = useAppDispatch();
  const { isLoading: loading, error } = useAppSelector(s => s.auth);

  // Clear error on mount
  useEffect(() => { dispatch(clearError()); }, [dispatch]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Auto-focus first OTP input when entering step 2
  useEffect(() => {
    if (step === 2) {
      const timer = setTimeout(() => inputRefs.current[0]?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleSendOtp = useCallback(async () => {
    if (submittingRef.current) return;
    if (!name.trim()) { Alert.alert('Error', 'Please enter your full name'); return; }
    if (name.trim().length < 2) { Alert.alert('Error', 'Name must be at least 2 characters'); return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { Alert.alert('Error', 'Please enter a valid 10-digit Indian mobile number'); return; }

    submittingRef.current = true;
    dispatch(clearError());
    try {
      mediumHaptic();
      const result = await dispatch(sendOtp({ phone, purpose: 'register' }));
      if (sendOtp.fulfilled.match(result)) {
        setSessionId(result.payload.sessionId);
        setStep(2);
        setCountdown(RESEND_COOLDOWN);
      }
    } finally {
      submittingRef.current = false;
    }
  }, [dispatch, name, phone]);

  const handleOtpChange = useCallback((text: string, index: number) => {
    const digit = text.replace(/\D/g, '');
    if (digit.length > 1) {
      // Handle paste
      const digits = digit.split('').slice(0, OTP_LENGTH);
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < OTP_LENGTH) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [otp]);

  const handleKeyPress = useCallback((e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  const otpString = otp.join('');
  const isOtpComplete = otpString.length === OTP_LENGTH;

  const handleCreateAccount = useCallback(async () => {
    if (submittingRef.current || !isOtpComplete) return;
    submittingRef.current = true;
    try {
      mediumHaptic();
      const result = await dispatch(registerWithOtp({ name: name.trim(), phone, otp: otpString, sessionId }));
      if (registerWithOtp.fulfilled.match(result)) {
        successHaptic();
        // isAuthenticated=true triggers RootNavigator auto-redirect
      }
    } finally {
      submittingRef.current = false;
    }
  }, [dispatch, name, phone, otpString, sessionId, isOtpComplete]);

  const handleResend = useCallback(async () => {
    if (countdown > 0) return;
    mediumHaptic();
    const result = await dispatch(sendOtp({ phone }));
    if (sendOtp.fulfilled.match(result)) {
      setSessionId(result.payload.sessionId);
      setOtp(Array(OTP_LENGTH).fill(''));
      setCountdown(RESEND_COOLDOWN);
      inputRefs.current[0]?.focus();
    }
  }, [dispatch, phone, countdown]);

  const handleBack = useCallback(() => {
    if (step === 2) {
      dispatch(clearError());
      setOtp(Array(OTP_LENGTH).fill(''));
      setStep(1);
    } else {
      navigation.goBack();
    }
  }, [step, navigation, dispatch]);

  const maskedPhone = '******' + phone.slice(-4);

  return (
    <LinearGradient colors={['#4c1d95', '#2e1065', '#1a0a3e']} style={styles.gradient}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Logo + Brand header */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/icons/appicon.png')}
              style={styles.logoBox}
              resizeMode="contain"
              accessibilityLabel="CampusOne logo"
            />
            <Text style={styles.brandName}>CampusOne</Text>
            <Text style={styles.tagline}>Your campus, one tap away</Text>
          </View>

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityLabel="Go back" accessibilityRole="button">
            <Icon name="arrow-back" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.backText}>{step === 2 ? 'Back' : 'Back to Login'}</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.title}>{step === 1 ? 'Create Account' : 'Verify OTP'}</Text>
          {step === 2 && (
            <Text style={styles.subtitle}>Enter the OTP sent to {maskedPhone}</Text>
          )}

          {/* Form */}
          <View style={styles.form}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {step === 1 ? (
              <>
                {/* Full Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your full name"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    accessibilityLabel="Full name"
                  />
                </View>

                {/* Phone Number */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <View style={styles.phoneRow}>
                    <Text style={styles.phonePrefix}>+91</Text>
                    <View style={styles.phoneDivider} />
                    <TextInput
                      style={styles.phoneInput}
                      value={phone}
                      onChangeText={val => setPhone(val.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit number"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      keyboardType="phone-pad"
                      maxLength={10}
                      accessibilityLabel="Phone number"
                    />
                  </View>
                </View>

                {/* Send OTP Button */}
                <TouchableOpacity
                  style={[styles.btnWrap, loading && styles.btnDisabled]}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                  accessibilityLabel="Send OTP"
                  accessibilityRole="button">
                  <View style={styles.btnContent}>
                    <LinearGradient
                      colors={['#9333ea', '#7c3aed']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <View style={styles.btnInner}>
                        <Text style={styles.btnText}>Send OTP</Text>
                        <Icon name="arrow-forward" size={18} color="#fff" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* OTP Input Boxes */}
                <View style={styles.otpRow}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => { inputRefs.current[index] = ref; }}
                      style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={index === 0 ? OTP_LENGTH : 1}
                      selectTextOnFocus
                      accessibilityLabel={`OTP digit ${index + 1}`}
                      {...(index === 0 && {
                        textContentType: 'oneTimeCode',
                        autoComplete: 'sms-otp',
                      })}
                    />
                  ))}
                </View>

                {/* Create Account Button */}
                <TouchableOpacity
                  style={[styles.btnWrap, (!isOtpComplete || loading) && styles.btnDisabled]}
                  onPress={handleCreateAccount}
                  disabled={!isOtpComplete || loading}
                  activeOpacity={0.85}
                  accessibilityLabel="Create Account"
                  accessibilityRole="button">
                  <View style={styles.btnContent}>
                    <LinearGradient
                      colors={['#9333ea', '#7c3aed']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    {loading ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.btnText}>Creating Account...</Text>
                      </>
                    ) : (
                      <View style={styles.btnInner}>
                        <Text style={styles.btnText}>Create Account</Text>
                        <Icon name="arrow-forward" size={18} color="#fff" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Resend OTP */}
                <View style={styles.resendRow}>
                  {countdown > 0 ? (
                    <Text style={styles.resendCountdown}>Resend OTP in {countdown}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend} accessibilityLabel="Resend OTP" accessibilityRole="button">
                      <Text style={styles.resendActiveText}>Resend OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>CampusOne - Madras Engineering College</Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 36, paddingBottom: 24 },

  // Header
  header: { alignItems: 'center', marginBottom: 24 },
  logoBox: { width: 72, height: 72, marginBottom: 12 },
  brandName: { fontSize: 26, fontWeight: '800', color: '#fff' },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  backText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 12 },

  // Form
  form: { gap: 18 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 12, padding: 12,
  },
  errorText: { color: '#fca5a5', fontSize: 13, textAlign: 'center' },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: '#fff' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 15,
    color: '#fff',
  },

  // Phone row
  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14, overflow: 'hidden',
  },
  phonePrefix: { paddingLeft: 16, paddingRight: 12, fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  phoneDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.2)' },
  phoneInput: { flex: 1, paddingLeft: 12, paddingRight: 16, paddingVertical: 16, fontSize: 15, color: '#fff' },

  // OTP boxes
  otpRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 4,
  },
  otpBox: {
    width: 48, height: 56, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    textAlign: 'center', fontSize: 20, fontWeight: '700', color: '#fff',
  },
  otpBoxFilled: {
    borderColor: '#9333ea',
    backgroundColor: 'rgba(147,51,234,0.15)',
  },

  // Buttons
  btnWrap: { marginTop: 4, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.5 },
  btnContent: {
    flexDirection: 'row', paddingVertical: 18, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Resend
  resendRow: { alignItems: 'center', marginTop: 16 },
  resendCountdown: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  resendActiveText: { fontSize: 14, color: '#a78bfa', fontWeight: '600' },

  // Footer
  footer: { alignItems: 'center', paddingBottom: 20, paddingTop: 12 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
});
