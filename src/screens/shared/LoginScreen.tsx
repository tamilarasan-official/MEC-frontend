import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { mediumHaptic } from '../../utils/haptics';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { sendOtp, clearError } from '../../store/slices/authSlice';
import Icon from '../../components/common/Icon';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const dispatch = useAppDispatch();
  const { isLoading: loading, error } = useAppSelector(s => s.auth);
  const isFormValid = /^[6-9]\d{9}$/.test(phone);
  const submittingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      dispatch(clearError());
    });
    return unsubscribe;
  }, [navigation, dispatch]);

  const handlePhoneChange = useCallback((val: string) => {
    setPhone(val.replace(/\D/g, '').slice(0, 10));
  }, []);

  const handleSendOtp = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      mediumHaptic();
      const result = await dispatch(sendOtp({ phone }));
      if (sendOtp.fulfilled.match(result)) {
        const { sessionId } = result.payload;
        navigation.navigate('OTP', { phone, sessionId });
      }
    } finally {
      submittingRef.current = false;
    }
  }, [dispatch, phone, navigation]);

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

          {/* Form */}
          <View style={styles.form}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Phone Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneRow}>
                <Text style={styles.phonePrefix}>+91</Text>
                <View style={styles.phoneDivider} />
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={() => isFormValid && !loading && handleSendOtp()}
                  accessibilityLabel="Phone number"
                />
              </View>
            </View>

            {/* Send OTP Button */}
            <TouchableOpacity
              style={[styles.signInBtn, (!isFormValid || loading) && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={!isFormValid || loading}
              activeOpacity={0.85}
              accessibilityLabel="Send OTP"
              accessibilityRole="button">
              <View style={styles.signInInner}>
                <LinearGradient
                  colors={['#9333ea', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.signInText}>Sending OTP...</Text>
                  </>
                ) : (
                  <>
                    <Icon name="call-outline" size={16} color="#fff" />
                    <Text style={styles.signInText}>Send OTP</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
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
  brand: { alignItems: 'center', marginBottom: 48 },
  logo: { width: 88, height: 88, marginBottom: 14 },
  brandName: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  brandTagline: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 6 },

  // Form
  form: { gap: 20 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 12, padding: 12,
  },
  errorText: { color: '#fca5a5', fontSize: 13, textAlign: 'center' },

  inputGroup: { gap: 10 },
  label: { fontSize: 14, fontWeight: '700', color: '#fff' },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14, overflow: 'hidden',
  },
  phonePrefix: {
    paddingLeft: 16, paddingRight: 12,
    fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: '600',
  },
  phoneDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.2)' },
  phoneInput: {
    flex: 1, paddingLeft: 12, paddingRight: 16,
    paddingVertical: 16, fontSize: 15, color: '#fff',
  },

  // Send OTP
  signInBtn: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.5 },
  signInInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 18,
  },
  signInText: { fontSize: 16, fontWeight: '700', color: '#fff' },

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
