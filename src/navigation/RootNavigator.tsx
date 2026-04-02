import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, DeviceEventEmitter, AppState, Platform, Linking, Animated, Easing, StatusBar } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { refreshUserData, resetAuth } from '../store/slices/authSlice';
import { fetchWalletBalance, fetchDashboardStats, fetchNotifications } from '../store/slices/userSlice';
import { fetchMyActiveOrders, fetchActiveShopOrders } from '../store/slices/ordersSlice';
import { getAccessToken, isSessionExpired, clearTokens, updateLastActivity } from '../services/api';
import { RootStackParamList } from '../types';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { ORDER_STATUS_POPUP_EVENT, LOGIN_SUCCESS_EVENT, FORCE_LOGOUT_EVENT } from '../constants/events';
import Icon from '../components/common/Icon';
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
} from '../services/notificationService';
import { checkForUpdate, UpdateInfo } from '../services/versionService';
import { UpdatePromptModal } from '../components/common/UpdatePromptModal';
import { PermissionDrawer } from '../components/common/PermissionDrawer';

const Stack = createNativeStackNavigator<RootStackParamList>();

/* ── Login Success Overlay ── */
function LoginSuccessOverlay({ name, role, onDone }: { name: string; role: string; onDone: () => void }) {
  const checkScale = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const roleOpacity = useRef(new Animated.Value(0)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    StatusBar.setBarStyle('light-content', true);

    Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();

    const fade = (anim: Animated.Value, delay: number) =>
      Animated.timing(anim, { toValue: 1, duration: 400, delay, easing: Easing.out(Easing.ease), useNativeDriver: true });

    Animated.stagger(0, [
      fade(titleOpacity, 300),
      fade(nameOpacity, 500),
      fade(roleOpacity, 500),
      fade(welcomeOpacity, 700),
      fade(taglineOpacity, 900),
    ]).start();

    const timer = setTimeout(() => {
      StatusBar.setBarStyle('default', true);
      onDone();
    }, 3000);
    return () => { clearTimeout(timer); StatusBar.setBarStyle('default', true); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayRole = role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : 'User';

  return (
    <View style={loginOverlay.container}>
      <Animated.View style={[loginOverlay.checkCircle, { transform: [{ scale: checkScale }] }]}>
        <Icon name="checkmark-circle" size={80} color="#fff" />
      </Animated.View>
      <Animated.Text style={[loginOverlay.title, { opacity: titleOpacity }]}>Login Successful</Animated.Text>
      <Animated.Text style={[loginOverlay.userName, { opacity: nameOpacity }]}>{name}</Animated.Text>
      <Animated.View style={[loginOverlay.roleBadge, { opacity: roleOpacity }]}>
        <Text style={loginOverlay.roleText}>{displayRole}</Text>
      </Animated.View>
      <Animated.Text style={[loginOverlay.welcome, { opacity: welcomeOpacity }]}>Welcome to CampusOne</Animated.Text>
      <Animated.Text style={[loginOverlay.tagline, { opacity: taglineOpacity }]}>Start using it and you'll never stop!</Animated.Text>
    </View>
  );
}

const loginOverlay = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject, zIndex: 9999, elevation: 9999,
    backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  checkCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 12 },
  userName: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 12, textAlign: 'center' },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 28,
  },
  roleText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  welcome: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
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

    Animated.timing(bgAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    Animated.stagger(150, [
      Animated.spring(iconScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(titleAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(msg1Anim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(msg2Anim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(btnAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.sequence([
        Animated.timing(iconShake, { toValue: 12, duration: 80, useNativeDriver: true }),
        Animated.timing(iconShake, { toValue: -12, duration: 80, useNativeDriver: true }),
        Animated.timing(iconShake, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(iconShake, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(iconShake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }, 400);

    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ])).start();

    return () => { StatusBar.setBarStyle('default'); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(bgAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(onDismiss);
    });
  };

  return (
    <Animated.View style={[forceLogoutStyles.overlay, { opacity: bgAnim }]}>
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

interface PopupData {
  status: 'preparing' | 'partially_ready' | 'ready' | 'partially_delivered' | 'completed' | 'cancelled';
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
  const [permissionsHandled, setPermissionsHandled] = useState(false);
  const [loginSuccessData, setLoginSuccessData] = useState<{ name: string; role: string } | null>(null);

  // PIN setup check — show setup screen if user hasn't set up PIN
  // Use !user.isPinSetup (not === false) so users who predate the PIN feature
  // (isPinSetup is undefined) are also prompted to set up their PIN.
  const needsPinSetup = isAuthenticated && user && !user.isPinSetup && !isCheckingAuth;

  if (__DEV__ && isAuthenticated && user) {
    console.log('[RootNavigator] PIN check:', { isPinSetup: user.isPinSetup, needsPinSetup, permissionsHandled, loginSuccessData: !!loginSuccessData });
  }

  // Listen for login success event (emitted from OTPScreen after auth succeeds)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(LOGIN_SUCCESS_EVENT, (data: { name: string; role: string }) => {
      setLoginSuccessData(data);
    });
    return () => sub.remove();
  }, []);

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
    await clearTokens();
    dispatch(resetAuth());
  }, [dispatch]);

  // Listen for forced app update (426 from backend)
  useEffect(() => {
    const storeUrl = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/campusone/id0000000000'
      : 'https://play.google.com/store/apps/details?id=com.mec.campusone';
    const sub = DeviceEventEmitter.addListener('FORCE_UPDATE_REQUIRED', () => {
      setUpdateInfo({
        updateAvailable: true,
        forceUpdate: true,
        latestVersion: 'latest',
        updateUrl: storeUrl,
      });
    });
    return () => sub.remove();
  }, []);

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
  const userModeChangedRef = useRef(false);
  useEffect(() => {
    // Skip the initial mount — the login effect above handles the first connection
    if (!userModeChangedRef.current) {
      userModeChangedRef.current = true;
      return;
    }
    if (!isAuthenticated || !userIdRef.current || !userRoleRef.current) return;
    let cancelled = false;
    disconnectSocket();
    (async () => {
      const sock = await connectSocket(
        userIdRef.current!, userRoleRef.current!, userShopIdRef.current, userMode
      );
      if (!cancelled && sock) {
        setupSocketListeners(dispatch, userRoleRef.current!, userMode);
      }
    })();
    return () => { cancelled = true; };
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
        dispatch(fetchNotifications());
        const mode = userModeRef.current;
        if (role === 'student' || mode === 'eat') {
          dispatch(fetchMyActiveOrders());
        } else {
          dispatch(fetchActiveShopOrders());
          dispatch(fetchDashboardStats());
        }
      }
    });
    return () => subscription.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

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

      {/* Permission drawer — shown once on first app launch, only when authenticated */}
      {isAuthenticated && !permissionsHandled && (
        <PermissionDrawer onComplete={() => setPermissionsHandled(true)} />
      )}

      {/* Login success animation — rendered at root level so it survives the Auth→Main navigation swap */}
      {loginSuccessData && (
        <LoginSuccessOverlay
          name={loginSuccessData.name}
          role={loginSuccessData.role}
          onDone={() => setLoginSuccessData(null)}
        />
      )}

      {showForceLogout && (
        <ForceLogoutOverlay onDismiss={handleForceLogoutDismiss} />
      )}

      {/* PIN setup gate — shown AFTER permissions and login overlay are dismissed.
          Blocks the app until the user sets up a transaction PIN. */}
      {needsPinSetup && permissionsHandled && !loginSuccessData && (
        <SetupPINScreen onComplete={() => dispatch(refreshUserData())} />
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
