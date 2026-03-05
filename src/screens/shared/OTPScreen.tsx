import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { mediumHaptic, successHaptic } from '../../utils/haptics';
import LinearGradient from 'react-native-linear-gradient';
import { getHash } from 'react-native-otp-verify';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { loginWithOtp, sendOtp, clearError } from '../../store/slices/authSlice';
import Icon from '../../components/common/Icon';

type Props = NativeStackScreenProps<AuthStackParamList, 'OTP'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function OTPScreen({ navigation, route }: Props) {
  const { phone, sessionId: initialSessionId } = route.params;
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const dispatch = useAppDispatch();
  const { isLoading: loading, error } = useAppSelector(s => s.auth);
  const submittingRef = useRef(false);

  const maskedPhone = '******' + phone.slice(-4);

  // Auto-focus first input
  useEffect(() => {
    const timer = setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

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

  // Clear error on mount
  useEffect(() => { dispatch(clearError()); }, [dispatch]);

  // Log app hash in dev (useful if SMS Retriever is configured later)
  useEffect(() => {
    if (Platform.OS !== 'android' || !__DEV__) return;
    getHash()
      .then((hashes: string[]) => console.log('[OTP] App hash:', hashes))
      .catch(() => {});
  }, []);

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

  const handleVerify = useCallback(async () => {
    if (submittingRef.current || !isOtpComplete) return;
    submittingRef.current = true;
    try {
      mediumHaptic();
      const result = await dispatch(loginWithOtp({ phone, otp: otpString, sessionId }));
      if (loginWithOtp.fulfilled.match(result)) {
        successHaptic();
      }
    } finally {
      submittingRef.current = false;
    }
  }, [dispatch, phone, otpString, sessionId, isOtpComplete]);

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

  const handleChangeNumber = useCallback(() => {
    dispatch(clearError());
    navigation.goBack();
  }, [navigation, dispatch]);

  return (
    <LinearGradient colors={['#4c1d95', '#2e1065', '#1a0a3e']} style={styles.gradient}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Brand */}
          <View style={styles.brand}>
            <Image
              source={require('../../assets/icons/appicon.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="CampusOne logo"
            />
            <Text style={styles.brandName}>CampusOne</Text>
            <Text style={styles.brandTagline}>Your campus, one tap away</Text>
          </View>

          {/* Shield Icon */}
          <View style={styles.shieldContainer}>
            <View style={styles.shieldCircle}>
              <Icon name="shield-checkmark" size={32} color="#a78bfa" />
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.heading}>Verify OTP</Text>
          <Text style={styles.subheading}>
            Enter the OTP sent to {maskedPhone}
          </Text>

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

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.verifyBtn, (!isOtpComplete || loading) && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={!isOtpComplete || loading}
            activeOpacity={0.85}
            accessibilityLabel="Verify and login"
            accessibilityRole="button">
            <View style={styles.verifyInner}>
              <LinearGradient
                colors={['#9333ea', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.verifyText}>Verifying...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.verifyText}>Verify & Login</Text>
                  <Icon name="arrow-forward" size={16} color="#fff" />
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Change Number + Resend */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={handleChangeNumber} accessibilityLabel="Change phone number" accessibilityRole="button">
              <Text style={styles.changeNumberText}>Change number</Text>
            </TouchableOpacity>
            {countdown > 0 ? (
              <Text style={styles.resendCountdown}>Resend in {countdown}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResend} accessibilityLabel="Resend OTP" accessibilityRole="button">
                <Text style={styles.resendActiveText}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Create Account */}
          <View style={styles.createSection}>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.8}
              accessibilityLabel="Create an account"
              accessibilityRole="button">
              <Text style={styles.createBtnText}>Create an Account</Text>
            </TouchableOpacity>
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
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 24 },

  // Brand
  brand: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 88, height: 88, marginBottom: 14 },
  brandName: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  brandTagline: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 6 },

  // Shield icon
  shieldContainer: { alignItems: 'center', marginBottom: 16 },
  shieldCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Headings
  heading: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subheading: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: 28 },

  // OTP boxes
  otpRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20,
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

  // Error
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  errorText: { color: '#fca5a5', fontSize: 13, textAlign: 'center' },

  // Verify button
  verifyBtn: { marginTop: 4, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.5 },
  verifyInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 18,
  },
  verifyText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Actions row
  actionsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 20, paddingHorizontal: 4,
  },
  changeNumberText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  resendCountdown: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  resendActiveText: { fontSize: 14, color: '#a78bfa', fontWeight: '600' },

  // Create Account
  createSection: { marginTop: 40 },
  createBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Footer
  footer: { alignItems: 'center', paddingBottom: 20, paddingTop: 12 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
});
