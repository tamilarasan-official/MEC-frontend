import React, { useEffect, useState, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootState, AppDispatch } from '../store';
import { refreshUserData } from '../store/slices/authSlice';
import { RootStackParamList } from '../types';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import AuthStack from './AuthStack';
import StudentTabs from './tabs/StudentTabs';
import CaptainTabs from './tabs/CaptainTabs';
import OwnerTabs from './tabs/OwnerTabs';
import SuperAdminTabs from './tabs/SuperAdminTabs';
import AccountantTabs from './tabs/AccountantTabs';
import { connectSocket, disconnectSocket, setupSocketListeners } from '../services/socketService';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // On mount, check for stored tokens and try to restore session
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('@madrasone_access_token');
        if (token) {
          // Try to fetch the current user with the stored token
          await dispatch(refreshUserData()).unwrap();
        }
      } catch {
        // Token expired or invalid - user stays logged out
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [dispatch]);

  // Connect/disconnect socket based on auth state
  useEffect(() => {
    if (isAuthenticated && user) {
      connectSocket(user.id, user.role, user.shopId);
      setupSocketListeners(dispatch, user.role, 'work');
    } else {
      disconnectSocket();
    }
    return () => { disconnectSocket(); };
  }, [isAuthenticated, user, dispatch]);

  if (isCheckingAuth) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : user?.role === 'superadmin' ? (
        <Stack.Screen name="SuperAdminMain" component={SuperAdminTabs} />
      ) : user?.role === 'accountant' ? (
        <Stack.Screen name="AccountantMain" component={AccountantTabs} />
      ) : user?.role === 'captain' ? (
        <Stack.Screen name="CaptainMain" component={CaptainTabs} />
      ) : user?.role === 'owner' ? (
        <Stack.Screen name="OwnerMain" component={OwnerTabs} />
      ) : (
        <Stack.Screen name="StudentMain" component={StudentTabs} />
      )}
    </Stack.Navigator>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
