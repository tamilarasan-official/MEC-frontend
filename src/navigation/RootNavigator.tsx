import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet, DeviceEventEmitter, AppState, Animated, StatusBar } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { refreshUserData, resetAuth } from '../store/slices/authSlice';
import { fetchWalletBalance, fetchDashboardStats, fetchNotifications } from '../store/slices/userSlice';
import { fetchActiveShopOrders, fetchMyActiveOrders } from '../store/slices/ordersSlice';
import { getAccessToken, isSessionExpired, clearTokens, updateLastActivity } from '../services/api';
import { RootStackParamList } from '../types';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { ORDER_STATUS_POPUP_EVENT, FORCE_LOGOUT_EVENT } from '../constants/events';
import { OrderStatusPopup } from '../components/common/OrderStatusPopup';
import AuthStack from './AuthStack';
import StudentTabs from './tabs/StudentTabs';
import CaptainTabs from './tabs/CaptainTabs';
import OwnerTabs from './tabs/OwnerTabs';
import { connectSocket, disconnectSocket, setupSocketListeners } from '../services/socketService';
import SetupPINScreen from '../screens/shared/SetupPINScreen';
import { getMessaging, onMessage, getInitialNotification } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import {
  initializeNotifications,
  handleForegroundMessage,
  cleanupNotifications,
  unregisterToken,
} from '../services/notificationService';
import { checkForUpdate, UpdateInfo } from '../services/versionService';
import { checkMaintenance, MaintenanceInfo } from '../services/maintenanceService';
import { UpdatePromptModal } from '../components/common/UpdatePromptModal';
import MaintenanceScreen from '../screens/shared/MaintenanceScreen';
import {
  isLocationPermissionGranted,
  requestLocationPermission,
  startLocationTracking,
  stopLocationTracking,
} from '../services/locationService';
import LocationPermissionGate from '../components/common/LocationPermissionGate';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface PopupData {
  status: 'preparing' | 'partially_ready' | 'ready' | 'completed' | 'cancelled';
  orderNumber: string;
  pickupToken?: string;
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
  const [popupQueue, setPopupQueue] = useState<PopupData[]>([]);
  const currentPopup = popupQueue.length > 0 ? popupQueue[0] : null;
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [maintenanceInfo, setMaintenanceInfo] = useState<MaintenanceInfo | null>(null);
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);
  const prevAuthRef = useRef(false);

  // Detect fresh login (isAuthenticated transitions false → true, not on app restore)
  useEffect(() => {
    if (!isCheckingAuth && isAuthenticated && !prevAuthRef.current) {
      setShowLoginSuccess(true);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, isCheckingAuth]);

  // PIN setup check — show setup screen if user hasn't set up PIN
  const needsPinSetup = isAuthenticated && user && user.isPinSetup === false && !isCheckingAuth;

  // ── Location permission & tracking ────────────────────────────
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'never_ask_again' | 'checking'>('checking');

  // Check + request location permission after authentication
  useEffect(() => {
    if (!isAuthenticated || !user || isCheckingAuth) {
      setLocationPermission('checking');
      return;
    }

    let cancelled = false;
    // Delay location permission request to avoid clashing with the notification
    // permission dialog — Android only shows one permission dialog at a time.
    // The notification useEffect (initializeNotifications) fires in the same
    // render cycle and requests POST_NOTIFICATIONS first.
    const timer = setTimeout(async () => {
      try {
        const granted = await isLocationPermissionGranted();
        if (cancelled) return;
        if (granted) {
          setLocationPermission('granted');
          startLocationTracking();
        } else {
          const result = await requestLocationPermission();
          if (cancelled) return;
          setLocationPermission(result);
          if (result === 'granted') {
            startLocationTracking();
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[Location] Permission flow error:', e);
        if (!cancelled) setLocationPermission('denied');
      }
    }, 4000); // 4s — enough for notification dialog to be answered

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopLocationTracking();
    };
  }, [isAuthenticated, user?.id, isCheckingAuth]);

  // Re-check permission when app comes to foreground (user may have changed in Settings)
  useEffect(() => {
    if (!isAuthenticated || !user || locationPermission === 'checking') return;
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' && locationPermission !== 'granted') {
        const granted = await isLocationPermissionGranted();
        if (granted) {
          setLocationPermission('granted');
          startLocationTracking();
        }
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, user?.id, locationPermission]);

  const handleRequestLocation = useCallback(async () => {
    const result = await requestLocationPermission();
    setLocationPermission(result);
    if (result === 'granted') {
      startLocationTracking();
    }
  }, []);

  const showLocationGate = isAuthenticated && !isCheckingAuth && locationPermission !== 'granted' && locationPermission !== 'checking';

  // Listen for order status popup events (from socket + FCM) — queued
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(ORDER_STATUS_POPUP_EVENT, (data: PopupData) => {
      if (__DEV__) console.log('[RootNavigator] OrderStatusPopup queued:', data);
      setPopupQueue(prev => [...prev, data]);
    });
    return () => subscription.remove();
  }, []);

  // Dismiss current popup → show next in queue
  const dismissPopup = useCallback(() => {
    setPopupQueue(prev => prev.slice(1));
  }, []);

  // Listen for force_logout (another device logged in with this account)
  const [showForceLogout, setShowForceLogout] = useState(false);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(FORCE_LOGOUT_EVENT, () => {
      setShowForceLogout(true);
    });
    return () => subscription.remove();
  }, []);

  const handleForceLogoutDismiss = useCallback(async () => {
    setShowForceLogout(false);
    disconnectSocket();
    // Clean FCM token so old device stops receiving push notifications
    try { await unregisterToken(); } catch { /* best-effort */ }
    await clearTokens();
    dispatch(resetAuth());
  }, [dispatch]);

  // Listen for forced app update (426 from backend)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('FORCE_UPDATE_REQUIRED', () => {
      setUpdateInfo({
        updateAvailable: true,
        forceUpdate: true,
        latestVersion: 'latest',
        updateUrl: 'https://play.google.com/store/apps/details?id=com.mec.campusone',
      });
    });
    return () => sub.remove();
  }, []);

  // Listen for maintenance mode — from Socket.IO (real-time) and 503 interceptor
  useEffect(() => {
    // Socket.IO: maintenance:enabled event (broadcast from superadmin toggle)
    const { getSocket } = require('../services/socketService');
    const socket = typeof getSocket === 'function' ? getSocket() : null;

    const handleEnabled = (data: { message: string; estimatedDuration: number; startedAt: string }) => {
      setMaintenanceInfo({
        maintenanceEnabled: true,
        message: data.message || 'App is under maintenance',
        estimatedDuration: data.estimatedDuration || 1,
        startedAt: data.startedAt || null,
      });
    };
    const handleDisabled = () => {
      setMaintenanceInfo(null);
    };

    if (socket) {
      socket.on('maintenance:enabled', handleEnabled);
      socket.on('maintenance:disabled', handleDisabled);
    }

    // DeviceEventEmitter: 503 from API interceptor
    const sub503 = DeviceEventEmitter.addListener('MAINTENANCE_MODE_DETECTED', () => {
      // Re-check the actual maintenance status endpoint
      checkMaintenance().then((info) => {
        if (info?.maintenanceEnabled) {
          setMaintenanceInfo(info);
        }
      });
    });

    return () => {
      if (socket) {
        socket.off('maintenance:enabled', handleEnabled);
        socket.off('maintenance:disabled', handleDisabled);
      }
      sub503.remove();
    };
  }, [isAuthenticated]);

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

    // Maintenance check — fire-and-forget, non-blocking
    checkMaintenance().then((info) => {
      if (info?.maintenanceEnabled) {
        setMaintenanceInfo(info);
      }
    });
  }, [dispatch]);

  // Connect/disconnect socket based on auth state
  // NOTE: Depend on user?.id (primitive) — NOT user (object ref) — to prevent
  // infinite re-render loops when fetchWalletBalance updates the balance.
  useEffect(() => {
    if (isAuthenticated && user) {
      try {
        connectSocket(user.id, user.role, user.shopId);
        setupSocketListeners(dispatch, user.role, userModeRef.current, user.id);
      } catch {
        // Socket connection failed — app continues without real-time updates
      }
    } else {
      disconnectSocket();
    }
    return () => { disconnectSocket(); };
  }, [isAuthenticated, user?.id, dispatch]);

  // Re-setup socket listeners when eat/work mode changes (no reconnect needed)
  useEffect(() => {
    if (isAuthenticated && user) {
      setupSocketListeners(dispatch, user.role, userMode, user.id);
    }
  }, [userMode, isAuthenticated, user?.id, dispatch]);

  // Disconnect socket when app is backgrounded to save battery (Bug #59)
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      try {
        if (appStateRef.current.match(/active/) && nextAppState === 'background') {
          disconnectSocket();
        } else if (appStateRef.current.match(/background|inactive/) && nextAppState === 'active') {
          // Await socket connection before setting up listeners — prevents
          // setupSocketListeners from running while socket is still null
          await connectSocket(user.id, user.role, user.shopId);
          setupSocketListeners(dispatch, user.role, userModeRef.current, user.id);
          // Refresh critical data on app resume — socket was disconnected in
          // background so events (orders, wallet, notifications) may have been missed
          dispatch(fetchWalletBalance());
          dispatch(fetchNotifications());
          if (user.role === 'student') {
            dispatch(fetchMyActiveOrders());
          } else {
            dispatch(fetchActiveShopOrders());
            dispatch(fetchDashboardStats());
          }
        }
      } catch {
        // Swallow errors on resume — network may be unavailable, token may be stale.
        // The app continues without real-time updates; next foreground cycle retries.
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, [isAuthenticated, user?.id, dispatch]);

  // Initialize push notifications + request camera permission after authentication
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    initializeNotifications(user.id);

    // Request camera permission early so Scanner tab works without settings redirect
    import('react-native-vision-camera').then(({ Camera }) => {
      const status = Camera.getCameraPermissionStatus();
      if (status === 'not-determined') {
        Camera.requestCameraPermission();
      }
    }).catch(() => {});

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
  }, [isAuthenticated, user?.id, dispatch]);

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

  // Maintenance retry handler — re-checks the endpoint and clears if resolved
  const handleMaintenanceRetry = useCallback(() => {
    checkMaintenance().then((info) => {
      if (!info?.maintenanceEnabled) {
        setMaintenanceInfo(null);
      } else {
        setMaintenanceInfo(info);
      }
    });
  }, []);

  if (isCheckingAuth) {
    return (
      <View style={staticStyles.splash}>
        <StatusBar barStyle="light-content" backgroundColor="#7c3aed" />
        <Image source={require('../assets/icons/appicon.png')} style={staticStyles.splashLogo} />
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

      {currentPopup && (
        <OrderStatusPopup
          key={`${currentPopup.orderNumber}-${currentPopup.status}`}
          status={currentPopup.status}
          orderNumber={currentPopup.orderNumber}
          pickupToken={currentPopup.pickupToken}
          itemNames={currentPopup.itemNames}
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

      {showLoginSuccess && user && (
        <LoginSuccessOverlay name={user.name} role={user.userTag || user.role} onDone={() => setShowLoginSuccess(false)} />
      )}

      {showForceLogout && (
        <ForceLogoutOverlay onDismiss={handleForceLogoutDismiss} />
      )}

      {needsPinSetup && !showLoginSuccess && (
        <SetupPINScreen onComplete={() => dispatch(refreshUserData())} />
      )}

      {showLocationGate && (
        <LocationPermissionGate
          permissionStatus={locationPermission as 'denied' | 'never_ask_again'}
          onRequestPermission={handleRequestLocation}
        />
      )}

      {maintenanceInfo?.maintenanceEnabled && (
        <MaintenanceScreen info={maintenanceInfo} onRetry={handleMaintenanceRetry} />
      )}
    </>
  );
}

/* ─── Login Success Overlay ─── */
function LoginSuccessOverlay({ name, role, onDone }: { name: string; role: string; onDone: () => void }) {
  const checkAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const nameAnim = useRef(new Animated.Value(0)).current;
  const roleAnim = useRef(new Animated.Value(0)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    Animated.stagger(200, [
      Animated.spring(checkAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(titleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(nameAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(roleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(taglineAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(subtitleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      StatusBar.setBarStyle('default');
      onDone();
    }, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <View style={loginStyles.overlay}>
      <Animated.View style={[loginStyles.iconWrap, { transform: [{ scale: checkAnim }] }]}>
        <View style={loginStyles.iconCircle}>
          <Text style={loginStyles.checkIcon}>✓</Text>
        </View>
      </Animated.View>
      <Animated.Text style={[loginStyles.title, { opacity: titleAnim }]}>Login Successful</Animated.Text>
      <Animated.Text style={[loginStyles.name, { opacity: nameAnim }]}>{name}</Animated.Text>
      <Animated.View style={[loginStyles.roleBadge, { opacity: roleAnim }]}>
        <Text style={loginStyles.roleText}>{roleLabel}</Text>
      </Animated.View>
      <Animated.Text style={[loginStyles.tagline, { opacity: taglineAnim }]}>Welcome to CampusOne</Animated.Text>
      <Animated.Text style={[loginStyles.subtitle, { opacity: subtitleAnim }]}>Start using it and you'll never stop!</Animated.Text>
    </View>
  );
}

const loginStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 9999,
    backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  iconWrap: { marginBottom: 24 },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  checkIcon: { fontSize: 64, color: '#fff', fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  name: { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 12 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 6, marginBottom: 20,
  },
  roleText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
});

/* ─── Force Logout Overlay ─── */
function ForceLogoutOverlay({ onDismiss }: { onDismiss: () => void }) {
  const bgAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconShake = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const msg1Anim = useRef(new Animated.Value(0)).current;
  const msg2Anim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    StatusBar.setBarStyle('light-content');

    // Background fade in
    Animated.timing(bgAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    // Staggered content
    Animated.stagger(150, [
      Animated.spring(iconScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(titleAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(msg1Anim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(msg2Anim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(btnAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();

    // Icon shake after landing
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(iconShake, { toValue: 12, duration: 80, useNativeDriver: true }),
        Animated.timing(iconShake, { toValue: -12, duration: 80, useNativeDriver: true }),
        Animated.timing(iconShake, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(iconShake, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(iconShake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }, 400);

    // Pulsing ring
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ])).start();

    return () => { StatusBar.setBarStyle('default'); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePress = () => {
    // Button press animation then dismiss
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(bgAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(onDismiss);
    });
  };

  return (
    <Animated.View style={[forceLogoutStyles.overlay, { opacity: bgAnim }]}>
      {/* Pulsing ring behind icon */}
      <Animated.View style={[forceLogoutStyles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />

      <Animated.View style={[forceLogoutStyles.iconWrap, { transform: [{ scale: iconScale }, { translateX: iconShake }] }]}>
        <View style={forceLogoutStyles.iconOuter}>
          <View style={forceLogoutStyles.iconInner}>
            <Text style={forceLogoutStyles.iconEmoji}>🔒</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.Text style={[forceLogoutStyles.title, { opacity: titleAnim, transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
        Session Ended
      </Animated.Text>

      <Animated.Text style={[forceLogoutStyles.message, { opacity: msg1Anim, transform: [{ translateY: msg1Anim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
        Your account was logged in on another device.
      </Animated.Text>

      <Animated.Text style={[forceLogoutStyles.submessage, { opacity: msg2Anim, transform: [{ translateY: msg2Anim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
        Only one device can be active at a time.
      </Animated.Text>

      <Animated.View style={{ opacity: btnAnim, transform: [{ scale: Animated.multiply(btnAnim, btnScale) }] }}>
        <Animated.View style={forceLogoutStyles.btnShadow}>
          <View style={forceLogoutStyles.btn}>
            <Text style={forceLogoutStyles.btnText} onPress={handlePress}>OK, GOT IT</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const forceLogoutStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 99999,
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  pulseRing: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)',
  },
  iconWrap: { marginBottom: 28 },
  iconOuter: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  iconInner: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  iconEmoji: { fontSize: 40 },
  title: {
    fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 12, textAlign: 'center',
  },
  message: {
    fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.9)',
    textAlign: 'center', lineHeight: 22, marginBottom: 4,
  },
  submessage: {
    fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 36,
  },
  btnShadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  btn: {
    backgroundColor: '#fff', paddingHorizontal: 48, paddingVertical: 18,
    borderRadius: 20,
  },
  btnText: {
    fontSize: 16, fontWeight: '800', color: '#ef4444', letterSpacing: 1, textAlign: 'center',
  },
});

const staticStyles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
  },
  splashLogo: {
    width: 90,
    height: 90,
    borderRadius: 22,
  },
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
});
