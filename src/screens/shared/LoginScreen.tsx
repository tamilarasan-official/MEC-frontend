import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { login } from '../../store/slices/authSlice';
import Icon from '../../components/common/Icon';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useAppDispatch();
  const { isLoading: loading, error } = useAppSelector(s => s.auth);
  const isFormValid = username.trim().length > 0 && password.trim().length > 0;

  const handleLogin = async () => {
    dispatch(login({ username: username.trim(), password }));
  };

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

            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username / Roll No</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter username or roll number"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
              />
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInBtn, (!isFormValid || loading) && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={!isFormValid || loading}
              activeOpacity={0.85}>
              <LinearGradient
                colors={['#9333ea', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGradient}>
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.signInText}>Signing in...</Text>
                  </>
                ) : (
                  <>
                    <Icon name="lock-closed" size={16} color="#fff" />
                    <Text style={styles.signInText}>Sign In</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Create Account */}
          <View style={styles.createSection}>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.8}>
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

  // Sign In
  signInBtn: { marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  signInGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 14, paddingVertical: 18,
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
