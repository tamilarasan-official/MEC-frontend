import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { mediumHaptic } from '../../utils/haptics';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { login, clearError } from '../../store/slices/authSlice';
import Icon from '../../components/common/Icon';

type Props = NativeStackScreenProps<AuthStackParamList, 'UsernameLogin'>;

export default function UsernameLoginScreen({ navigation }: Props) {
    const insets = useSafeAreaInsets();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const dispatch = useAppDispatch();
    const { isLoading: loading, error } = useAppSelector(s => s.auth);
    const isPhoneValid = /^[6-9]\d{9}$/.test(phone);
    const isFormValid = isPhoneValid && password.length >= 4;
    const submittingRef = useRef(false);
    const passwordRef = useRef<TextInput>(null);

    const handlePhoneChange = useCallback((val: string) => {
        setPhone(val.replace(/\D/g, '').slice(0, 10));
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            dispatch(clearError());
        });
        return unsubscribe;
    }, [navigation, dispatch]);

    const handleLogin = useCallback(async () => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        try {
            mediumHaptic();
            await dispatch(login({ username: phone, password })).unwrap();
        } catch {
            // error handled by redux
        } finally {
            submittingRef.current = false;
        }
    }, [dispatch, phone, password]);

    return (
        <LinearGradient colors={['#4c1d95', '#2e1065', '#1a0a3e']} style={styles.gradient}>
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top + 10, 60) }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}>

                    {/* Back to OTP Login */}
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                        accessibilityLabel="Back to OTP login"
                        accessibilityRole="button">
                        <Icon name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.backBtnText}>OTP Login</Text>
                    </TouchableOpacity>

                    {/* Brand */}
                    <View style={styles.brand}>
                        <Image
                            source={require('../../assets/icons/appicon.png')}
                            style={styles.logo}
                            resizeMode="contain"
                            accessibilityLabel="CampusOne logo"
                        />
                        <Text style={styles.brandName}>CampusOne</Text>
                        <Text style={styles.brandTagline}>Sign in with your phone & password</Text>
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
                                    returnKeyType="next"
                                    onSubmitEditing={() => passwordRef.current?.focus()}
                                    accessibilityLabel="Phone number"
                                />
                            </View>
                        </View>

                        {/* Password */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.inputRow}>
                                <Icon name="lock-closed-outline" size={18} color="rgba(255,255,255,0.5)" />
                                <TextInput
                                    ref={passwordRef}
                                    style={styles.textInput}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Enter your password"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="done"
                                    onSubmitEditing={() => isFormValid && !loading && handleLogin()}
                                    accessibilityLabel="Password"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(p => !p)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                                    <Icon
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color="rgba(255,255,255,0.5)"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Login Button */}
                        <TouchableOpacity
                            style={[styles.signInBtn, (!isFormValid || loading) && styles.btnDisabled]}
                            onPress={handleLogin}
                            disabled={!isFormValid || loading}
                            activeOpacity={0.85}
                            accessibilityLabel="Login"
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
                                        <Text style={styles.signInText}>Signing in...</Text>
                                    </>
                                ) : (
                                    <>
                                        <Icon name="log-in-outline" size={18} color="#fff" />
                                        <Text style={styles.signInText}>Sign In</Text>
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
    scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 24 },

    // Back button
    backBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12,
    },
    backBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

    // Brand
    brand: { alignItems: 'center', marginTop: 16, marginBottom: 40 },
    logo: { width: 80, height: 80, marginBottom: 12 },
    brandName: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    brandTagline: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 6 },

    // Form
    form: { gap: 18 },
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
    inputRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: 14, paddingHorizontal: 16,
    },
    textInput: {
        flex: 1, paddingVertical: 16, fontSize: 15, color: '#fff',
    },

    // Sign in
    signInBtn: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
    btnDisabled: { opacity: 0.5 },
    signInInner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        paddingVertical: 18,
    },
    signInText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    // Create Account
    createSection: { marginTop: 36 },
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
