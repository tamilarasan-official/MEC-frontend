import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Platform,
  Dimensions, StatusBar, Linking, Alert,
} from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { requestPermission, getMessaging, AuthorizationStatus as FBAuthorizationStatus } from '@react-native-firebase/messaging';
import { Camera } from 'react-native-vision-camera';
import Icon from './Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PermissionItem {
  key: 'notifications' | 'camera';
  icon: string;
  title: string;
  description: string;
  color: string;
}

const PERMISSIONS: PermissionItem[] = [
  {
    key: 'notifications',
    icon: 'notifications-outline',
    title: 'Notifications',
    description: 'Get instant updates on your order status, wallet credits, and important announcements.',
    color: '#3b82f6',
  },
  {
    key: 'camera',
    icon: 'camera-outline',
    title: 'Camera Access',
    description: 'Scan QR codes to verify orders and make quick payments at campus shops.',
    color: '#10b981',
  },
];

interface PermissionDrawerProps {
  onComplete: () => void;
}

/** Check current notification permission status */
async function getNotifStatus(): Promise<'granted' | 'denied' | 'not-determined'> {
  try {
    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) return 'granted';
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) return 'denied';
    return 'not-determined';
  } catch {
    return 'not-determined';
  }
}

/** Check current camera permission status */
function getCameraStatus(): 'granted' | 'denied' | 'not-determined' {
  const status = Camera.getCameraPermissionStatus();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'not-determined';
}

export function PermissionDrawer({ onComplete }: PermissionDrawerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [visible, setVisible] = useState(false);
  const [granted, setGranted] = useState<Record<string, boolean>>({});
  const [requesting, setRequesting] = useState(false);
  const requestingRef = useRef(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Show drawer if any required permission is not yet granted
  useEffect(() => {
    (async () => {
      try {
        const notifStatus = await getNotifStatus();
        const cameraStatus = getCameraStatus();

        if (notifStatus === 'granted' && cameraStatus === 'granted') {
          // All permissions already granted — skip
          onComplete();
        } else {
          // Pre-populate already-granted items
          setGranted({
            notifications: notifStatus === 'granted',
            camera: cameraStatus === 'granted',
          });
          setVisible(true);
        }
      } catch {
        setVisible(true);
      }
    })();
  }, [onComplete]);

  // Animate in when visible
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 9,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      onComplete();
    });
  }, [slideAnim, backdropAnim, onComplete]);

  const openSettings = useCallback(() => {
    Alert.alert(
      'Permission Required',
      'This permission was previously denied. Please enable it in your device Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
  }, []);

  const handleAllowAll = useCallback(async () => {
    if (requestingRef.current) return;
    requestingRef.current = true;
    setRequesting(true);
    const results: Record<string, boolean> = { ...granted };
    let needsSettings = false;

    // 1. Notifications
    if (!results.notifications) {
      const status = await getNotifStatus();
      // On Android 13+, notification permission starts as 'denied' before ever being requested.
      // Always attempt the request on Android; only skip on iOS if truly denied.
      if (status === 'denied' && Platform.OS === 'ios') {
        needsSettings = true;
        results.notifications = false;
      } else {
        try {
          if (Platform.OS === 'ios') {
            const authStatus = await requestPermission(getMessaging());
            results.notifications =
              authStatus === FBAuthorizationStatus.AUTHORIZED ||
              authStatus === FBAuthorizationStatus.PROVISIONAL;
          } else {
            const settings = await notifee.requestPermission();
            results.notifications = settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
            if (!results.notifications) {
              needsSettings = true;
            }
          }
        } catch {
          results.notifications = false;
        }
      }
      setGranted({ ...results });
    }

    // 2. Camera
    if (!results.camera) {
      // On Android, 'denied' doesn't mean permanently denied — we can still request.
      // Only treat as permanently denied on iOS.
      const status = getCameraStatus();
      if (status === 'denied' && Platform.OS === 'ios') {
        needsSettings = true;
        results.camera = false;
      } else {
        try {
          const cameraResult = await Camera.requestCameraPermission();
          results.camera = cameraResult === 'granted';
          if (!results.camera && Platform.OS === 'android') {
            needsSettings = true;
          }
        } catch {
          results.camera = false;
        }
      }
      setGranted({ ...results });
    }

    setRequesting(false);
    requestingRef.current = false;

    if (needsSettings && (!results.notifications || !results.camera)) {
      // Some permissions were denied previously — prompt to go to Settings
      openSettings();
    } else {
      // Auto-dismiss after showing checkmarks
      setTimeout(handleDismiss, 600);
    }
  }, [handleDismiss, granted, openSettings]);

  if (!visible) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none">
      <StatusBar barStyle="light-content" />
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleDismiss} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View style={[styles.drawer, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle bar */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconCircle}>
            <Icon name="shield-checkmark" size={28} color={colors.primary} />
          </View>
          <Text style={styles.headerTitle}>Enable Permissions</Text>
          <Text style={styles.headerSubtitle}>
            CampusOne needs a few permissions to give you the best experience
          </Text>
        </View>

        {/* Permission items */}
        <View style={styles.permissionsList}>
          {PERMISSIONS.map((perm, idx) => {
            const isGranted = granted[perm.key];
            return (
              <View
                key={perm.key}
                style={[
                  styles.permissionItem,
                  idx < PERMISSIONS.length - 1 && styles.permissionItemBorder,
                ]}
              >
                <View style={[styles.permissionIcon, { backgroundColor: isGranted ? colors.primary + '18' : perm.color + '18' }]}>
                  <Icon
                    name={isGranted ? 'checkmark-circle' : perm.icon}
                    size={22}
                    color={isGranted ? colors.primary : perm.color}
                  />
                </View>
                <View style={styles.permissionText}>
                  <Text style={styles.permissionTitle}>{perm.title}</Text>
                  <Text style={styles.permissionDesc}>{perm.description}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.allowBtn, requesting && { opacity: 0.6 }]}
            onPress={handleAllowAll}
            activeOpacity={0.6}
            disabled={requesting}
          >
            {requesting ? (
              <Text style={styles.allowBtnText}>Granting...</Text>
            ) : (
              <>
                <Icon name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.allowBtnText}>Allow All</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.skipBtnText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>

        {/* Fine print */}
        <Text style={styles.finePrint}>
          You can change these anytime in your device settings
        </Text>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.foreground,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  permissionsList: {
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  permissionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  permissionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 2,
  },
  permissionDesc: {
    fontSize: 12,
    color: colors.mutedForeground,
    lineHeight: 17,
  },
  buttonRow: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 10,
  },
  allowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
  },
  allowBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  finePrint: {
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingTop: 8,
    paddingHorizontal: 24,
    opacity: 0.7,
  },
});
