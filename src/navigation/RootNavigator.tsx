import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, DeviceEventEmitter, AppState } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { refreshUserData } from '../store/slices/authSlice';
import { fetchWalletBalance } from '../store/slices/userSlice';
import { getAccessToken, isSessionExpired, clearTokens, updateLastActivity } from '../services/api';
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
import { getMessaging, onMessage, getInitialNotification } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import {
  initializeNotifications,
  handleForegroundMessage,
  cleanupNotifications,
} from '../services/notificationService';
import { checkForUpdate, UpdateInfo } from '../services/versionService';
import { UpdatePromptModal } from '../components/common/UpdatePromptModal';
import { PermissionDrawer } from '../components/common/PermissionDrawer';

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
  const userMode = useSelector((s: RootState) => s.user.userMode);
  const userModeRef = useRef(userMode);
  useEffect(() => { userModeRef.current = userMode; }, [userMode]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [permissionsHandled, setPermissionsHandled] = useState(false);

  // Listen for order status popup events (from socket + FCM)
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(ORDER_STATUS_POPUP_EVENT, (data: PopupData) => {
      if (__DEV__) console.log('[RootNavigator] OrderStatusPopup event received:', data);
      setPopup(data);
    });
    return () => subscription.remove();
  }, []);

  const dismissPopup = useCallback(() => setPopup(null), []);

  // On mount, check for stored tokens and try to restore session
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setIsCheckingAuth(false);
          return;
        }

        // Check 3-day inactivity — if expired, clear session and show login
        const expired = await isSessionExpired();
        if (expired) {
          await clearTokens();
          setIsCheckingAuth(false);
          return;
        }

        // Token exists and session is within 3 days — restore session
        await dispatch(refreshUserData()).unwrap();
        // Session restored successfully — update last activity
        await updateLastActivity();
      } catch {
        // Token refresh failed — interceptor handles retry + 3-day logic
        // User stays logged out only if interceptor cleared the tokens
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();

    // Version check — fire-and-forget, non-blocking
    checkForUpdate().then((info) => {
      if (info?.updateAvailable) {
        setUpdateInfo(info);
      }
    });
  }, [dispatch]);

  // Connect/disconnect socket based on auth state
  useEffect(() => {
    if (isAuthenticated && user) {
      try {
        connectSocket(user.id, user.role, user.shopId);
        setupSocketListeners(dispatch, user.role, userModeRef.current);
      } catch {
        // Socket connection failed — app continues without real-time updates
      }
    } else {
      disconnectSocket();
    }
    return () => { disconnectSocket(); };
  }, [isAuthenticated, user, dispatch]);

  // Re-setup socket listeners when eat/work mode changes (no reconnect needed)
  useEffect(() => {
    if (isAuthenticated && user) {
      setupSocketListeners(dispatch, user.role, userMode);
    }
  }, [userMode, isAuthenticated, user, dispatch]);

  // Disconnect socket when app is backgrounded to save battery (Bug #59)
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/active/) && nextAppState === 'background') {
        disconnectSocket();
      } else if (appStateRef.current.match(/background|inactive/) && nextAppState === 'active') {
        connectSocket(user.id, user.role, user.shopId);
        setupSocketListeners(dispatch, user.role, userModeRef.current);
        // Refresh wallet balance on app resume — socket was disconnected in
        // background so any wallet:updated events (e.g. accountant credit) were missed
        dispatch(fetchWalletBalance());
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, [isAuthenticated, user, dispatch]);

  // Initialize push notifications after authentication
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    initializeNotifications(user.id);

    // Foreground FCM message listener
    const unsubscribeFcm = onMessage(getMessaging(), (remoteMessage) => {
      handleForegroundMessage(remoteMessage, dispatch);
    });

    // Notifee foreground event handler (notification tap while app is open)
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        if (__DEV__) console.log('[Notifee] Foreground press:', detail.notification?.data);
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
    getInitialNotification(getMessaging()).then(msg => {
      if (msg?.data && __DEV__) {
        console.log('[Notifications] Cold-start:', msg.data);
      }
    }).catch(() => {});
    notifee.getInitialNotification().then(initial => {
      if (initial?.notification?.data && __DEV__) {
        console.log('[Notifee] Cold-start:', initial.notification.data);
      }
    }).catch(() => {});
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

      {updateInfo && (
        <UpdatePromptModal
          visible={!!updateInfo}
          forceUpdate={updateInfo.forceUpdate}
          latestVersion={updateInfo.latestVersion}
          updateUrl={updateInfo.updateUrl}
          onDismiss={() => {
            if (!updateInfo.forceUpdate) {
              setUpdateInfo(null);
            }
          }}
        />
      )}

      {/* Permission drawer — shown once on first launch after login */}
      {isAuthenticated && !permissionsHandled && (
        <PermissionDrawer onComplete={() => setPermissionsHandled(true)} />
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
