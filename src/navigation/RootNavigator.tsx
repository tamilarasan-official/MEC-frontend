import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, DeviceEventEmitter, AppState, Platform, Linking } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { refreshUserData } from '../store/slices/authSlice';
import { fetchWalletBalance } from '../store/slices/userSlice';
import { fetchMyActiveOrders, fetchActiveShopOrders } from '../store/slices/ordersSlice';
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
  status: 'preparing' | 'partially_ready' | 'ready' | 'partially_delivered' | 'completed' | 'cancelled';
  orderNumber: string;
  itemNames?: string[];
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

  // Request battery optimization exemption on Android (one-time)
  // Without this, OEMs like Motorola/Samsung kill the app after a few minutes
  useEffect(() => {
    if (!isAuthenticated || Platform.OS !== 'android') return;
    // Use sendIntent to trigger the system battery optimization dialog
    Linking.sendIntent(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      [{ key: 'data', value: 'package:com.mec.campusone' }]
    ).catch(() => {
      // Device doesn't support this intent — non-critical
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Stable refs for socket — avoids re-running effects when user object changes
  const userIdRef = useRef(user?.id);
  const userRoleRef = useRef(user?.role);
  const userShopIdRef = useRef(user?.shopId);
  useEffect(() => {
    userIdRef.current = user?.id;
    userRoleRef.current = user?.role;
    userShopIdRef.current = user?.shopId;
  }, [user?.id, user?.role, user?.shopId]);

  // Connect socket once on login, disconnect on logout/unmount
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      disconnectSocket();
      return;
    }
    const userId = user.id;
    const role = user.role;
    const shopId = user.shopId;

    (async () => {
      try {
        const sock = await connectSocket(userId, role, shopId, userModeRef.current);
        if (sock) {
          setupSocketListeners(dispatch, role, userModeRef.current);
        }
      } catch {
        // Socket connection failed — app continues without real-time updates
      }
    })();

    return () => { disconnectSocket(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // Reconnect socket when eat/work mode changes (need to rejoin/leave shop room)
  useEffect(() => {
    if (!isAuthenticated || !userIdRef.current || !userRoleRef.current) return;
    // Reconnect to change room membership (eat mode leaves shop room)
    disconnectSocket();
    (async () => {
      const sock = await connectSocket(
        userIdRef.current!, userRoleRef.current!, userShopIdRef.current, userMode
      );
      if (sock) {
        setupSocketListeners(dispatch, userRoleRef.current!, userMode);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMode]);

  // Background/foreground app state handling
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextAppState;

      if (prev.match(/active/) && nextAppState === 'background') {
        // Only disconnect on Android — OEM battery managers kill apps with active sockets
        // iOS handles background sockets efficiently and needs them for real-time notifications
        if (Platform.OS === 'android') {
          disconnectSocket();
        }
      } else if (prev.match(/background/) && nextAppState === 'active') {
        const id = userIdRef.current;
        const role = userRoleRef.current;
        const shopId = userShopIdRef.current;
        if (id && role) {
          const sock = await connectSocket(id, role, shopId, userModeRef.current);
          if (sock) {
            setupSocketListeners(dispatch, role, userModeRef.current);
          }
        }
        // Refresh data on resume — events were missed while backgrounded
        dispatch(fetchWalletBalance());
        const mode = userModeRef.current;
        if (role === 'student' || mode === 'eat') {
          dispatch(fetchMyActiveOrders());
        } else {
          dispatch(fetchActiveShopOrders());
        }
      }
    });
    return () => subscription.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // Initialize push notifications after authentication
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    initializeNotifications(user.id);

    // Foreground FCM message listener
    const unsubscribeFcm = onMessage(getMessaging(), (remoteMessage) => {
      handleForegroundMessage(remoteMessage, dispatch, userRoleRef.current, userModeRef.current);
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

      {isAuthenticated && popup && (
        <OrderStatusPopup
          status={popup.status}
          orderNumber={popup.orderNumber}
          itemNames={popup.itemNames}
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

      {/* Permission drawer — shown once on first app launch, only when authenticated */}
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
