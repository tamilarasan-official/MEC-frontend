import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
  Modal, Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { register } from '../../store/slices/authSlice';
import Icon from '@react-native-vector-icons/ionicons';

const departments = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIDS', 'AIML'];
const years = [
  { label: '1st Year', value: '1' },
  { label: '2nd Year', value: '2' },
  { label: '3rd Year', value: '3' },
  { label: '4th Year', value: '4' },
];

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

interface DropdownPos { x: number; y: number; width: number }

export default function RegisterScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Dropdown state
  const [deptOpen, setDeptOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [deptPos, setDeptPos] = useState<DropdownPos>({ x: 0, y: 0, width: 0 });
  const [yearPos, setYearPos] = useState<DropdownPos>({ x: 0, y: 0, width: 0 });

  const deptRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const yearRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  const dispatch = useAppDispatch();
  const { isLoading: loading, error } = useAppSelector(s => s.auth);

  const openDept = () => {
    (deptRef.current as any)?.measure((_: number, __: number, width: number, height: number, pageX: number, pageY: number) => {
      setDeptPos({ x: pageX, y: pageY + height + 4, width });
      setDeptOpen(true);
    });
  };

  const openYear = () => {
    (yearRef.current as any)?.measure((_: number, __: number, width: number, height: number, pageX: number, pageY: number) => {
      setYearPos({ x: pageX, y: pageY + height + 4, width });
      setYearOpen(true);
    });
  };

  const handleRegister = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Please enter your full name'); return; }
    const generatedUsername = regNo.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (generatedUsername.length < 4) { Alert.alert('Error', 'Registration number must result in at least 4 valid characters'); return; }
    if (password !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
    if (password.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(password)) { Alert.alert('Error', 'Password must contain at least one uppercase letter'); return; }
    if (!/[a-z]/.test(password)) { Alert.alert('Error', 'Password must contain at least one lowercase letter'); return; }
    if (!/[0-9]/.test(password)) { Alert.alert('Error', 'Password must contain at least one number'); return; }
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/`~]/.test(password)) { Alert.alert('Error', 'Password must contain at least one special character'); return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { Alert.alert('Error', 'Please enter a valid 10-digit Indian mobile number'); return; }
    if (!department || !year) { Alert.alert('Error', 'Please select department and year'); return; }

    const result = await dispatch(register({
      username: generatedUsername,
      password,
      name,
      phone,
      rollNumber: regNo,
      department,
      year: parseInt(year, 10),
    }));

    if (register.fulfilled.match(result)) {
      Alert.alert('Success', 'Account created. Please log in.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    }
  };

  // Positioned dropdown modal
  const renderDropdown = (
    visible: boolean,
    onClose: () => void,
    pos: DropdownPos,
    items: { label: string; value: string }[],
    selectedValue: string,
    onSelect: (v: string) => void,
  ) => (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={[styles.dropdownList, { left: pos.x, top: pos.y, width: pos.width }]}>
        {items.map(item => {
          const isSelected = selectedValue === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
              onPress={() => { onSelect(item.value); onClose(); }}
              activeOpacity={0.8}>
              <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );

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
            />
            <Text style={styles.brandName}>CampusOne</Text>
            <Text style={styles.tagline}>Your campus, one tap away</Text>
          </View>

          {/* Back to Login */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.backText}>Back to Login</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.title}>Student Registration</Text>

          {/* Form */}
          <View style={styles.form}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
            </View>

            {/* MEC Registration No */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>MEC Registration No</Text>
              <TextInput
                style={styles.input}
                value={regNo}
                onChangeText={setRegNo}
                placeholder="e.g., MEC2024001"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="characters"
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
                />
              </View>
            </View>

            {/* Department & Year side by side */}
            <View style={styles.row}>
              <View style={styles.halfCol}>
                <Text style={styles.label}>Department</Text>
                <TouchableOpacity
                  ref={deptRef}
                  style={[styles.select, deptOpen && styles.selectOpen]}
                  onPress={openDept}
                  activeOpacity={0.8}>
                  <Text style={department ? styles.selectText : styles.selectPlaceholder}>
                    {department || 'Select'}
                  </Text>
                  <Icon
                    name={deptOpen ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color="rgba(255,255,255,0.5)"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.halfCol}>
                <Text style={styles.label}>Year of Study</Text>
                <TouchableOpacity
                  ref={yearRef}
                  style={[styles.select, yearOpen && styles.selectOpen]}
                  onPress={openYear}
                  activeOpacity={0.8}>
                  <Text style={year ? styles.selectText : styles.selectPlaceholder}>
                    {year ? years.find(y => y.value === year)?.label : 'Select'}
                  </Text>
                  <Icon
                    name={yearOpen ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color="rgba(255,255,255,0.5)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
              />
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
              />
            </View>

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.btnWrap, (loading || !department || !year) && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading || !department || !year}
              activeOpacity={0.85}>
              <LinearGradient
                colors={['#9333ea', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.btnInner}>
                    <Text style={styles.btnText}>Register</Text>
                    <Icon name="arrow-forward" size={18} color="#fff" />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>CampusOne - Madras Engineering College</Text>
        </View>

        {/* Positioned Dropdowns */}
        {renderDropdown(
          deptOpen,
          () => setDeptOpen(false),
          deptPos,
          departments.map(d => ({ label: d, value: d })),
          department,
          setDepartment,
        )}
        {renderDropdown(
          yearOpen,
          () => setYearOpen(false),
          yearPos,
          years,
          year,
          setYear,
        )}
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

  // Selects
  row: { flexDirection: 'row', gap: 12 },
  halfCol: { flex: 1, gap: 8 },
  select: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 16,
  },
  selectOpen: { borderColor: '#9333ea' },
  selectText: { fontSize: 15, color: '#fff', fontWeight: '500' },
  selectPlaceholder: { fontSize: 15, color: 'rgba(255,255,255,0.4)' },

  // Positioned dropdown list
  dropdownList: {
    position: 'absolute',
    backgroundColor: '#2e1065',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 999,
  },
  dropdownItem: {
    paddingHorizontal: 16, paddingVertical: 14,
  },
  dropdownItemActive: {
    backgroundColor: '#9333ea',
  },
  dropdownItemText: {
    fontSize: 15, fontWeight: '600', color: '#fff',
  },
  dropdownItemTextActive: {
    color: '#fff',
  },

  // Register button
  btnWrap: { marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnGradient: {
    borderRadius: 14, paddingVertical: 18, alignItems: 'center', justifyContent: 'center',
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Footer
  footer: { alignItems: 'center', paddingBottom: 20, paddingTop: 12 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
});
