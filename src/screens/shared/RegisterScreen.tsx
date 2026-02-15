import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
  Modal, FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { register } from '../../store/slices/authSlice';
import { colors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import ScreenWrapper from '../../components/common/ScreenWrapper';

const departments = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIDS', 'AIML'];
const years = [
  { label: '1st Year', value: 1 },
  { label: '2nd Year', value: 2 },
  { label: '3rd Year', value: 3 },
  { label: '4th Year', value: 4 },
];

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const dispatch = useAppDispatch();
  const { isLoading: loading, error } = useAppSelector(s => s.auth);

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    const generatedUsername = regNo.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (generatedUsername.length < 4) {
      Alert.alert('Error', 'Registration number must result in at least 4 valid characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      Alert.alert('Error', 'Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(password)) {
      Alert.alert('Error', 'Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(password)) {
      Alert.alert('Error', 'Password must contain at least one number');
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/`~]/.test(password)) {
      Alert.alert('Error', 'Password must contain at least one special character');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      Alert.alert('Error', 'Please enter a valid 10-digit Indian mobile number');
      return;
    }

    if (!department || !year) {
      Alert.alert('Error', 'Please select department and year');
      return;
    }

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

  const renderPickerModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    items: { label: string; value: string }[],
    onSelect: (value: string) => void,
  ) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => { onSelect(item.value); onClose(); }}
              >
                <Text style={styles.modalItemText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <ScreenWrapper edges={['top', 'left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#0ea5e9', '#10b981']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBox}
          >
            <Icon name="layers" size={40} color="#fff" />
          </LinearGradient>
          <Text style={styles.brandName}>MadrasOne</Text>
          <Text style={styles.tagline}>Your campus, one tap away</Text>
        </View>

        {/* Back to Login */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.title}>Student Registration</Text>

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
              placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
          </View>

          {/* Phone Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.phonePrefix}>+91</Text>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={(val) => setPhone(val.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit number"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>

          {/* Department & Year side by side */}
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Department</Text>
              <TouchableOpacity style={styles.select} onPress={() => setShowDeptPicker(true)}>
                <Text style={department ? styles.selectText : styles.selectPlaceholder}>
                  {department || 'Select'}
                </Text>
                <Icon name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Year of Study</Text>
              <TouchableOpacity style={styles.select} onPress={() => setShowYearPicker(true)}>
                <Text style={year ? styles.selectText : styles.selectPlaceholder}>
                  {year ? years.find(y => y.value.toString() === year)?.label : 'Select'}
                </Text>
                <Icon name="chevron-down" size={16} color={colors.textMuted} />
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
              placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.btn, (loading || !department || !year) && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading || !department || !year}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnInner}>
                <Text style={styles.btnText}>Register</Text>
                <Icon name="arrow-forward" size={18} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Pickers */}
      {renderPickerModal(
        showDeptPicker,
        () => setShowDeptPicker(false),
        'Select Department',
        departments.map(d => ({ label: d, value: d })),
        setDepartment,
      )}
      {renderPickerModal(
        showYearPicker,
        () => setShowYearPicker(false),
        'Select Year of Study',
        years.map(y => ({ label: y.label, value: y.value.toString() })),
        setYear,
      )}
    </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 48 },
  header: { alignItems: 'center', marginBottom: 24 },
  logoBox: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  brandName: { fontSize: 28, fontWeight: '800', color: colors.text },
  tagline: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { fontSize: 14, color: colors.textMuted },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 24 },
  form: { gap: 16 },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 12, padding: 12 },
  errorText: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text, backgroundColor: colors.card },
  phoneRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: 'hidden' },
  phonePrefix: { paddingLeft: 16, paddingRight: 8, fontSize: 15, color: colors.textMuted, fontWeight: '500' },
  phoneInput: { flex: 1, paddingVertical: 14, paddingRight: 16, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', gap: 12 },
  halfCol: { flex: 1, gap: 6 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.card },
  selectText: { fontSize: 15, color: colors.text },
  selectPlaceholder: { fontSize: 15, color: colors.textMuted },
  btn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: colors.card, borderRadius: 16, padding: 20, width: '80%', maxHeight: '50%' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12, textAlign: 'center' },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalItemText: { fontSize: 15, color: colors.text, textAlign: 'center' },
});
