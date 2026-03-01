import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, DeviceEventEmitter } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootState, AppDispatch } from '../store';
import { refreshUserData } from '../store/slices/authSlice';
import { RootStackParamList } from '../types';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { ORDER_STATUS_POPUP_EVENT } from '../constants/events';
import { OrderStatusPopup } from '../components/common/OrderStatusPopup';
import AuthStack from './AuthStack';
import StudentTabs from './tabs/StudentTabs';
import CaptainTabs from './tabs/CaptainTabs';
import OwnerTabs from './tabs/OwnerTabs';
import { connectSocket, disconnectSocket, setupSocketListeners } from '../services/socketService';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import {
  initializeNotifications,
  handleForegroundMessage,
  cleanupNotifications,
} from '../services/notificationService';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface PopupData {
  status: 'preparing' | 'ready' | 'completed' | 'cancelled';
  orderNumber: string;
}

export default function RootNavigator() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [popup, setPopup] = useState<PopupData | null>(null);

  // Listen for order status popup events (from socket + FCM)
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(ORDER_STATUS_POPUP_EVENT, (data: PopupData) => {
      console.log('[RootNavigator] OrderStatusPopup event received:', data);
      setPopup(data);
    });
    return () => subscription.remove();
  }, []);

  const dismissPopup = useCallback(() => setPopup(null), []);

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

  // Initialize push notifications after authentication
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    initializeNotifications(user.id);

    // Foreground FCM message listener
    const unsubscribeFcm = messaging().onMessage((remoteMessage) => {
      handleForegroundMessage(remoteMessage, dispatch);
    });

    // Notifee foreground event handler (notification tap while app is open)
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('[Notifee] Foreground press:', detail.notification?.data);
      }
    });

    return () => {
      unsubscribeFcm();
      unsubscribeNotifee();
      cleanupNotifications();
    };
  }, [isAuthenticated, user, dispatch]);

  // Handle cold-start notification (app opened by tapping a notification)
  useEffect(() => {
    if (!isAuthenticated) return;
    messaging().getInitialNotification().then(msg => {
      if (msg?.data) {
        console.log('[Notifications] Cold-start:', msg.data);
      }
    });
    notifee.getInitialNotification().then(initial => {
      if (initial?.notification?.data) {
        console.log('[Notifee] Cold-start:', initial.notification.data);
      }
    });
  }, [isAuthenticated]);

  if (isCheckingAuth) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : user?.role === 'captain' ? (
          <Stack.Screen name="CaptainMain" component={CaptainTabs} />
        ) : user?.role === 'owner' ? (
          <Stack.Screen name="OwnerMain" component={OwnerTabs} />
        ) : (
          <Stack.Screen name="StudentMain" component={StudentTabs} />
        )}
      </Stack.Navigator>

      {popup && (
        <OrderStatusPopup
          status={popup.status}
          orderNumber={popup.orderNumber}
          onDismiss={dismissPopup}
        />
      )}
    </>
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
