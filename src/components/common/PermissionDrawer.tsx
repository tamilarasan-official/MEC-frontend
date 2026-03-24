import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Platform,
  Dimensions, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { requestPermission, getMessaging, AuthorizationStatus as FBAuthorizationStatus } from '@react-native-firebase/messaging';
import Icon from './Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

const STORAGE_KEY = '@madrasone_permissions_shown';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PermissionItem {
  key: string;
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
    key: 'sms',
    icon: 'chatbubbles-outline',
    title: 'SMS (Auto-fill OTP)',
    description: 'Automatically read and fill OTP codes from SMS for quick, hassle-free login.',
    color: '#8b5cf6',
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
  /** Called after the user dismisses the drawer */
  onComplete: () => void;
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

  // Check if we should show the drawer
  useEffect(() => {
    (async () => {
      const shown = await AsyncStorage.getItem(STORAGE_KEY);
      if (!shown) {
        setVisible(true);
      }
    })();
  }, []);

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

  const handleDismiss = useCallback(async () => {
    // Animate out
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
    ]).start(async () => {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      setVisible(false);
      onComplete();
    });
  }, [slideAnim, backdropAnim, onComplete]);

  const handleAllowAll = useCallback(async () => {
    // Ref-based guard prevents double-tap (state update is too slow)
    if (requestingRef.current) return;
    requestingRef.current = true;
    setRequesting(true);
    const results: Record<string, boolean> = {};

    try {
      // 1. Request notification permission
      if (Platform.OS === 'ios') {
        const authStatus = await requestPermission(getMessaging());
        results.notifications =
          authStatus === FBAuthorizationStatus.AUTHORIZED ||
          authStatus === FBAuthorizationStatus.PROVISIONAL;
      } else {
        const settings = await notifee.requestPermission();
        results.notifications = settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
      }
    } catch {
      results.notifications = false;
    }

    // 2. SMS — Android SMS Retriever API doesn't need runtime permission
    results.sms = true;

    // 3. Camera — will be requested on-demand when scanner opens
    results.camera = true;

    setGranted(results);
    setRequesting(false);
    requestingRef.current = false;

    // Auto-dismiss quickly after showing the checkmarks
    setTimeout(handleDismiss, 300);
  }, [handleDismiss]);

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
                <View style={[styles.permissionIcon, { backgroundColor: perm.color + '18' }]}>
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
