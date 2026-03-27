import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
  Modal, FlatList, Keyboard,
} from 'react-native';
import { mediumHaptic } from '../../utils/haptics';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { sendOtp, clearError } from '../../store/slices/authSlice';
import Icon from '../../components/common/Icon';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

interface CountryItem {
  name: string;
  code: string;
  short: string;
  minLen: number;
  maxLen: number;
}

const COUNTRIES: CountryItem[] = [
  { name: 'India', code: '+91', short: 'IN', minLen: 10, maxLen: 10 },
  { name: 'United States', code: '+1', short: 'US', minLen: 10, maxLen: 10 },
  { name: 'United Kingdom', code: '+44', short: 'UK', minLen: 10, maxLen: 10 },
  { name: 'Canada', code: '+1', short: 'CA', minLen: 10, maxLen: 10 },
  { name: 'Australia', code: '+61', short: 'AU', minLen: 9, maxLen: 9 },
  { name: 'United Arab Emirates', code: '+971', short: 'AE', minLen: 9, maxLen: 9 },
  { name: 'Saudi Arabia', code: '+966', short: 'SA', minLen: 9, maxLen: 9 },
  { name: 'Singapore', code: '+65', short: 'SG', minLen: 8, maxLen: 8 },
  { name: 'Malaysia', code: '+60', short: 'MY', minLen: 9, maxLen: 10 },
  { name: 'Germany', code: '+49', short: 'DE', minLen: 10, maxLen: 11 },
  { name: 'France', code: '+33', short: 'FR', minLen: 9, maxLen: 9 },
  { name: 'Japan', code: '+81', short: 'JP', minLen: 10, maxLen: 10 },
  { name: 'South Korea', code: '+82', short: 'KR', minLen: 9, maxLen: 10 },
  { name: 'China', code: '+86', short: 'CN', minLen: 11, maxLen: 11 },
  { name: 'Indonesia', code: '+62', short: 'ID', minLen: 9, maxLen: 12 },
  { name: 'Bangladesh', code: '+880', short: 'BD', minLen: 10, maxLen: 10 },
  { name: 'Pakistan', code: '+92', short: 'PK', minLen: 10, maxLen: 10 },
  { name: 'Sri Lanka', code: '+94', short: 'LK', minLen: 9, maxLen: 9 },
  { name: 'Nepal', code: '+977', short: 'NP', minLen: 10, maxLen: 10 },
  { name: 'South Africa', code: '+27', short: 'ZA', minLen: 9, maxLen: 9 },
  { name: 'Nigeria', code: '+234', short: 'NG', minLen: 10, maxLen: 10 },
  { name: 'Kenya', code: '+254', short: 'KE', minLen: 9, maxLen: 9 },
  { name: 'Brazil', code: '+55', short: 'BR', minLen: 10, maxLen: 11 },
  { name: 'Mexico', code: '+52', short: 'MX', minLen: 10, maxLen: 10 },
  { name: 'Qatar', code: '+974', short: 'QA', minLen: 8, maxLen: 8 },
  { name: 'Kuwait', code: '+965', short: 'KW', minLen: 8, maxLen: 8 },
  { name: 'Oman', code: '+968', short: 'OM', minLen: 8, maxLen: 8 },
  { name: 'Bahrain', code: '+973', short: 'BH', minLen: 8, maxLen: 8 },
  { name: 'Thailand', code: '+66', short: 'TH', minLen: 9, maxLen: 9 },
  { name: 'Philippines', code: '+63', short: 'PH', minLen: 10, maxLen: 10 },
  { name: 'Vietnam', code: '+84', short: 'VN', minLen: 9, maxLen: 10 },
  { name: 'Italy', code: '+39', short: 'IT', minLen: 9, maxLen: 10 },
  { name: 'Spain', code: '+34', short: 'ES', minLen: 9, maxLen: 9 },
  { name: 'Netherlands', code: '+31', short: 'NL', minLen: 9, maxLen: 9 },
  { name: 'Sweden', code: '+46', short: 'SE', minLen: 9, maxLen: 9 },
  { name: 'New Zealand', code: '+64', short: 'NZ', minLen: 8, maxLen: 10 },
];

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryItem>(COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const dispatch = useAppDispatch();
  const { isLoading: loading, error } = useAppSelector(s => s.auth);
  const searchInputRef = useRef<TextInput>(null);

  const isFormValid = phone.length >= selectedCountry.minLen && phone.length <= selectedCountry.maxLen;
  const submittingRef = useRef(false);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.code.includes(q));
  }, [countrySearch]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      dispatch(clearError());
    });
    return unsubscribe;
  }, [navigation, dispatch]);

  const handlePhoneChange = useCallback((val: string) => {
    let digits = val.replace(/\D/g, '');
    // Strip common country code prefixes when pasting
    const codeDigits = selectedCountry.code.replace('+', '');
    if (digits.length > selectedCountry.maxLen && digits.startsWith(codeDigits)) {
      digits = digits.slice(codeDigits.length);
    }
    setPhone(digits.slice(0, selectedCountry.maxLen));
  }, [selectedCountry]);

  const handleSendOtp = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    Keyboard.dismiss();
    try {
      mediumHaptic();
      const fullPhone = selectedCountry.code === '+91' ? phone : `${selectedCountry.code}${phone}`;
      const result = await dispatch(sendOtp({ phone: fullPhone }));
      if (sendOtp.fulfilled.match(result)) {
        const { sessionId, isExistingUser, userName } = result.payload;
        navigation.navigate('OTP', { phone: fullPhone, sessionId, isExistingUser, userName });
      }
    } finally {
      submittingRef.current = false;
    }
  }, [dispatch, phone, selectedCountry, navigation]);

  // Auto-send OTP when phone number is complete
  useEffect(() => {
    if (phone.length === selectedCountry.maxLen && !submittingRef.current) {
      handleSendOtp();
    }
  }, [phone, selectedCountry.maxLen, handleSendOtp]);

  return (
    <LinearGradient colors={['#4c1d95', '#2e1065', '#1a0a3e']} style={styles.gradient}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top + 10, 60) }]}
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
                <TouchableOpacity
                  style={styles.countryPickerBtn}
                  onPress={() => { setCountrySearch(''); setShowCountryPicker(true); }}
                  activeOpacity={0.7}
                  accessibilityLabel="Select country code"
                  accessibilityRole="button">
                  <View style={styles.countryBadge}>
                    <Text style={styles.countryShort}>{selectedCountry.short}</Text>
                  </View>
                  <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                  <Icon name="chevron-down" size={14} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
                <View style={styles.phoneDivider} />
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  placeholder={`Enter ${selectedCountry.minLen}-digit number`}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="phone-pad"
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

          {/* Or divider */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          {/* Text links */}
          <View style={styles.linksSection}>
            <TouchableOpacity
              onPress={() => navigation.navigate('UsernameLogin')}
              activeOpacity={0.7}
              accessibilityLabel="Login with username and password"
              accessibilityRole="button">
              <Text style={styles.linkText}>Use Password to Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.7}
              accessibilityLabel="Create an account"
              accessibilityRole="button">
              <Text style={styles.linkText}>Create an Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>CampusOne</Text>
        </View>
      </KeyboardAvoidingView>

      {/* Country Code Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)} accessibilityLabel="Close" accessibilityRole="button">
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchRow}>
              <Icon name="search" size={18} color="rgba(255,255,255,0.4)" />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={countrySearch}
                onChangeText={setCountrySearch}
                placeholder="Search country or code..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoFocus
              />
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => `${item.code}-${item.name}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.code === selectedCountry.code && item.name === selectedCountry.name;
                return (
                  <TouchableOpacity
                    style={[styles.countryItem, isSelected && styles.countryItemSelected]}
                    onPress={() => {
                      setSelectedCountry(item);
                      setPhone('');
                      setShowCountryPicker(false);
                    }}
                    activeOpacity={0.7}>
                    <View style={styles.countryItemBadge}>
                      <Text style={styles.countryItemShort}>{item.short}</Text>
                    </View>
                    <Text style={styles.countryItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.countryItemCode}>{item.code}</Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.noResults}>No countries found</Text>}
            />
          </View>
        </View>
      </Modal>
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
  countryPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingLeft: 14, paddingRight: 10, paddingVertical: 16,
  },
  countryBadge: {
    width: 30, height: 22, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  countryShort: { fontSize: 12, fontWeight: '800', color: '#fff', lineHeight: 14 },
  countryCode: { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
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

  // Or divider
  orRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 4,
  },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  orText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', paddingHorizontal: 16, fontWeight: '500' },

  // Text links
  linksSection: { alignItems: 'center', gap: 18, marginTop: 8 },
  linkText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },

  // Footer
  footer: { alignItems: 'center', paddingBottom: 20, paddingTop: 12 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },

  // Country Picker Modal
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#1a0a3e', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%', paddingTop: 16,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 12,
  },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#fff', padding: 0 },
  countryItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 20,
  },
  countryItemSelected: { backgroundColor: 'rgba(147,51,234,0.2)' },
  countryItemBadge: {
    width: 34, height: 24, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  countryItemShort: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  countryItemName: { flex: 1, fontSize: 15, color: '#fff' },
  countryItemCode: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  noResults: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 24 },
});
