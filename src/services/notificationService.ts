import {
  getMessaging,
  getToken,
  requestPermission,
  onTokenRefresh,
  AuthorizationStatus as FBAuthorizationStatus,
} from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidCategory,
  EventType,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform, DeviceEventEmitter } from 'react-native';
import api, { getOrCreateDeviceId } from './api';
import { AppDispatch } from '../store';
import { addNotification, fetchWalletBalance } from '../store/slices/userSlice';
import { ORDER_STATUS_POPUP_EVENT, FORCE_LOGOUT_EVENT } from '../constants/events';

// ── Deduplication ───────────────────────────────────────────────
// Prevents double display when both Socket.IO and FCM deliver the same event
const recentKeys = new Set<string>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function isDuplicate(key: string): boolean {
  if (recentKeys.has(key)) return true;
  recentKeys.add(key);
  setTimeout(() => recentKeys.delete(key), DEDUP_TTL_MS);
  return false;
}

// ── Channel IDs ─────────────────────────────────────────────────
export const CHANNEL_ORDER_READY = 'order_ready';
export const CHANNEL_ORDER_UPDATES = 'order_updates';
export const CHANNEL_WALLET = 'wallet';
export const CHANNEL_GENERAL = 'general';

// ── Create Android notification channels ────────────────────────
export async function createChannels(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ORDER_READY,
    name: 'Order Ready',
    description: 'Alerts when your order is ready for pickup',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
  });
  await notifee.createChannel({
    id: CHANNEL_ORDER_UPDATES,
    name: 'Order Updates',
    description: 'Order status change notifications',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
  await notifee.createChannel({
    id: CHANNEL_WALLET,
    name: 'Wallet',
    description: 'Wallet transaction notifications',
    importance: AndroidImportance.DEFAULT,
  });
  await notifee.createChannel({
    id: CHANNEL_GENERAL,
    name: 'General',
    description: 'Announcements and system notifications',
    importance: AndroidImportance.DEFAULT,
  });
}

// ── Display: full-screen "order ready" notification ─────────────
export async function displayOrderReadyNotification(
  orderNumber: string,
  orderId: string,
): Promise<void> {
  await notifee.displayNotification({
    title: 'Order Ready for Pickup!',
    body: `Order #${orderNumber} is ready for pickup!`,
    data: { type: 'order', orderId, orderNumber, status: 'ready' },
    android: {
      channelId: CHANNEL_ORDER_READY,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      sound: 'default',
      fullScreenAction: { id: 'default' },
      pressAction: { id: 'default' },
      vibrationPattern: [300, 500, 300, 500],
    },
  });
}

// ── Display: full-screen notification for any order status ──────
// Shows as full-screen intent on lock screen, heads-up when screen is on
export async function displayOrderStatusFullScreen(
  title: string,
  body: string,
  orderNumber: string,
  orderId: string,
  status: string,
): Promise<void> {
  const channelId = status === 'ready' ? CHANNEL_ORDER_READY : CHANNEL_ORDER_UPDATES;
  await notifee.displayNotification({
    title,
    body,
    data: { type: 'order', orderId, orderNumber, status },
    android: {
      channelId,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      sound: 'default',
      fullScreenAction: {
        id: 'default',
        launchActivity: 'default',
      },
      pressAction: { id: 'default' },
      vibrationPattern: [300, 500, 300, 500],
      asForegroundService: true,
      lights: ['#3b82f6', 300, 600],
      autoCancel: true,
    },
  });
}

// ── Display: standard local notification ────────────────────────
// Pass an optional `id` to collapse/replace duplicate notifications
// (Notifee reuses the same tray slot when IDs match).
export async function displayLocalNotification(
  title: string,
  body: string,
  data: Record<string, string>,
  channelId: string = CHANNEL_GENERAL,
  notificationId?: string,
): Promise<void> {
  await notifee.displayNotification({
    ...(notificationId ? { id: notificationId } : {}),
    title,
    body,
    data,
    android: {
      channelId,
      pressAction: { id: 'default' },
    },
  });
}

// ── Handle foreground FCM message ───────────────────────────────
export function handleForegroundMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  dispatch: AppDispatch,
): void {
  const { data, notification } = remoteMessage;
  const title = notification?.title || (data?.title as string) || '';
  const body = notification?.body || (data?.body as string) || '';

  // Skip if there's no meaningful content to display
  if (!title.trim() && !body.trim()) return;
  const type = (data?.type as string) || 'system';

  // Force logout — emit event and skip normal notification flow
  if (type === 'force_logout') {
    if (__DEV__) console.log('[FCM] Force logout received via push');
    DeviceEventEmitter.emit(FORCE_LOGOUT_EVENT, { reason: 'logged_in_elsewhere' });
    return;
  }

  const orderId = data?.orderId as string;
  const status = data?.status as string;
  const orderNumber = data?.orderNumber as string;

  // Dedup: skip if already shown (e.g. socket delivered first, or duplicate FCM tokens)
  // Use content-based key so duplicate FCM messages (from stale tokens) are caught
  if (type === 'payment_received') {
    const paymentId = data?.paymentRequestId as string || '';
    if (isDuplicate(`payment:${paymentId}`)) return;
  } else if (orderId && status) {
    if (isDuplicate(`${orderId}:${status}`)) return;
  } else if (type === 'wallet_credit' || type === 'wallet') {
    // Use a stable key with 10-second window to catch duplicate FCM messages
    // while still allowing legitimate sequential wallet transactions
    const amount = data?.amount as string || '';
    const walletDedupKey = `wallet:credit:${amount}:${Math.floor(Date.now() / 10000)}`;
    if (isDuplicate(walletDedupKey)) {
      // Still refresh wallet balance even if notification is deduped
      // (matches socket handler behavior in socketService.ts)
      dispatch(fetchWalletBalance());
      return;
    }
  } else {
    // Content-based dedup for all other notifications (prevents duplicates from stale FCM tokens)
    const contentKey = `${type}:${title}:${body}:${Math.floor(Date.now() / 30000)}`;
    if (isDuplicate(contentKey)) return;
  }

  // Auto-refresh wallet balance when receiving wallet notifications via FCM
  // (covers cases where the socket missed the wallet:updated event)
  if (type === 'wallet_credit' || type === 'wallet') {
    dispatch(fetchWalletBalance());
  }

  // Determine channel and display strategy
  if (type === 'order' && ['preparing', 'partially_ready', 'ready', 'completed', 'cancelled'].includes(status)) {
    // Show full-screen popup for all order status changes
    if (__DEV__) console.log('[FCM] Emitting ORDER_STATUS_POPUP_EVENT:', status, orderNumber);
    DeviceEventEmitter.emit(ORDER_STATUS_POPUP_EVENT, {
      status,
      orderNumber: orderNumber || orderId?.slice(-6) || '',
    });
  } else {
    const channelId =
      type === 'order' ? CHANNEL_ORDER_UPDATES :
      type === 'wallet' ? CHANNEL_WALLET :
      CHANNEL_GENERAL;
    // Use a stable notification ID so Notifee replaces instead of stacking
    // if both socket and FCM slip through dedup
    const notifId = orderId ? `order-${orderId}` :
      (type === 'wallet_credit' || type === 'wallet') ? `wallet-${data?.amount || ''}` :
      undefined;
    displayLocalNotification(title, body, (data as Record<string, string>) || {}, channelId, notifId);
  }

  // Dispatch to Redux for in-app notification list
  dispatch(addNotification({
    id: remoteMessage.messageId || `fcm-${Date.now()}`,
    title,
    message: body,
    type: type as 'order' | 'wallet' | 'announcement' | 'system',
    read: false,
    createdAt: new Date().toISOString(),
    data: data as Record<string, unknown>,
  }));
}

// ── Handle background FCM message ───────────────────────────────
export async function handleBackgroundMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const { data, notification } = remoteMessage;

  // On Android, when a FCM message has a `notification` field and the app is
  // backgrounded, the OS auto-displays the notification. If we also create a
  // Notifee notification here, the user sees a duplicate (often with empty
  // content because the OS strips the `notification` property before passing
  // the message to the background handler). Skip Notifee display in this case.
  if (Platform.OS === 'android' && notification?.title) {
    return;
  }

  const title = notification?.title || (data?.title as string) || '';
  const body = notification?.body || (data?.body as string) || '';
  const type = (data?.type as string) || 'system';
  const orderId = data?.orderId as string;
  const status = data?.status as string;
  const orderNumber = data?.orderNumber as string;

  // Skip if there's no meaningful content to display
  if (!title && !body) return;

  // Dedup — same logic as foreground handler
  if (orderId && status) {
    if (isDuplicate(`${orderId}:${status}`)) return;
  } else if (type === 'wallet_credit' || type === 'wallet') {
    const amount = data?.amount as string || '';
    const walletDedupKey = `wallet:credit:${amount}:${Math.floor(Date.now() / 60000)}`;
    if (isDuplicate(walletDedupKey)) return;
  } else if (remoteMessage.messageId) {
    if (isDuplicate(remoteMessage.messageId)) return;
  }

  // Create channels (may not exist yet in headless JS context)
  await createChannels();

  // Full-screen notification for all order status changes (background/killed state)
  if (type === 'order' && ['preparing', 'partially_ready', 'ready', 'completed', 'cancelled'].includes(status)) {
    await displayOrderStatusFullScreen(title, body, orderNumber || '', orderId || '', status);
  } else {
    const channelId =
      type === 'order' ? CHANNEL_ORDER_UPDATES :
      type === 'wallet' ? CHANNEL_WALLET :
      CHANNEL_GENERAL;
    await displayLocalNotification(title, body, (data as Record<string, string>) || {}, channelId);
  }
  // No Redux dispatch here — store is not available in background/headless JS
}

// ── Register FCM token with backend ─────────────────────────────
async function registerTokenWithBackend(token: string, _userId: string): Promise<void> {
  try {
    const { getCurrentVersion } = require('./versionService');
    const deviceId = await getOrCreateDeviceId();
    await api.post('/auth/fcm-token', {
      token,
      deviceId,
      platform: Platform.OS,
      appVersion: getCurrentVersion(),
    });
    if (__DEV__) console.log('[Notifications] FCM token registered with backend');
  } catch (error) {
    if (__DEV__) console.warn('[Notifications] Failed to register FCM token:', error);
  }
}

// ── Re-register FCM token on app foreground ────────────────────
// Lightweight: just re-posts the existing token. Ensures tokens
// wiped by server-side cleanup (logout, cron) are restored.
export async function refreshTokenRegistration(userId: string): Promise<void> {
  try {
    const token = await getToken(getMessaging());
    if (token) await registerTokenWithBackend(token, userId);
  } catch { /* non-critical */ }
}

// ── Unregister FCM token (called on logout) ─────────────────────
export async function unregisterToken(): Promise<void> {
  try {
    const token = await getToken(getMessaging());
    if (token) {
      await api.delete('/auth/fcm-token', { data: { token } });
      if (__DEV__) console.log('[Notifications] FCM token unregistered');
    }
  } catch (error) {
    // Fallback: try to unregister by deviceId so the token doesn't linger
    try {
      const deviceId = await getOrCreateDeviceId();
      if (deviceId) {
        await api.delete('/auth/fcm-token', { data: { deviceId } });
      }
    } catch { /* ignore fallback failure */ }
    if (__DEV__) console.warn('[Notifications] Failed to unregister FCM token:', error);
  }
}

// ── Token refresh listener ──────────────────────────────────────
let tokenRefreshUnsubscribe: (() => void) | null = null;

export function setupTokenRefreshListener(userId: string): void {
  if (tokenRefreshUnsubscribe) {
    tokenRefreshUnsubscribe();
  }
  tokenRefreshUnsubscribe = onTokenRefresh(getMessaging(), (newToken) => {
    registerTokenWithBackend(newToken, userId);
  });
}

// ── Initialize everything ───────────────────────────────────────
export async function initializeNotifications(userId: string): Promise<void> {
  try {
    // 1. Request display permissions (controls whether notifications are shown)
    if (Platform.OS === 'ios') {
      const authStatus = await requestPermission(getMessaging());
      const enabled =
        authStatus === FBAuthorizationStatus.AUTHORIZED ||
        authStatus === FBAuthorizationStatus.PROVISIONAL;
      if (!enabled) {
        if (__DEV__) console.warn('[Notifications] iOS permission not granted');
        // Don't return — still register FCM token for data-only messages
      }
    }
    if (Platform.OS === 'android') {
      const settings = await notifee.requestPermission();
      if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
        if (__DEV__) console.warn('[Notifications] Android display permission not granted');
        // Don't return — FCM token works independently of display permission
      }
    }

    // 2. Create notification channels (Android-only, no-op on iOS)
    await createChannels();

    // 3. Get FCM token and register with backend — ALWAYS do this
    // FCM tokens work regardless of notification display permission.
    // The token is needed for push delivery; permission only controls display.
    const token = await getToken(getMessaging());
    if (token) {
      await registerTokenWithBackend(token, userId);
    } else {
      if (__DEV__) console.warn('[Notifications] getToken returned null — FCM not available');
    }

    // 4. Set up token refresh listener
    setupTokenRefreshListener(userId);

    if (__DEV__) console.log('[Notifications] Initialized for user:', userId);
  } catch (error) {
    // Don't let initialization failure crash the app — retry token registration
    if (__DEV__) console.warn('[Notifications] Initialization failed:', error);
    try {
      const token = await getToken(getMessaging());
      if (token) await registerTokenWithBackend(token, userId);
    } catch { /* final fallback — give up silently */ }
  }
}

// ── Cleanup (called on logout or unmount) ───────────────────────
export function cleanupNotifications(): void {
  if (tokenRefreshUnsubscribe) {
    tokenRefreshUnsubscribe();
    tokenRefreshUnsubscribe = null;
  }
  // Clear dedup set so a fresh login session starts clean —
  // prevents stale keys from suppressing the new user's notifications
  recentKeys.clear();
}
