import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidCategory,
  EventType,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform, DeviceEventEmitter } from 'react-native';
import api from './api';
import { AppDispatch } from '../store';
import { addNotification } from '../store/slices/userSlice';
import { ORDER_STATUS_POPUP_EVENT } from '../constants/events';

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
export async function displayLocalNotification(
  title: string,
  body: string,
  data: Record<string, string>,
  channelId: string = CHANNEL_GENERAL,
): Promise<void> {
  await notifee.displayNotification({
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
  const title = notification?.title || (data?.title as string) || 'Notification';
  const body = notification?.body || (data?.body as string) || '';
  const type = (data?.type as string) || 'system';
  const orderId = data?.orderId as string;
  const status = data?.status as string;
  const orderNumber = data?.orderNumber as string;

  // Dedup: skip if already shown (e.g. socket delivered first)
  if (orderId && status) {
    if (isDuplicate(`${orderId}:${status}`)) return;
  } else if (remoteMessage.messageId) {
    if (isDuplicate(remoteMessage.messageId)) return;
  }

  // Determine channel and display strategy
  if (type === 'order' && ['preparing', 'ready', 'completed', 'cancelled'].includes(status)) {
    // Show full-screen popup for all order status changes
    console.log('[FCM] Emitting ORDER_STATUS_POPUP_EVENT:', status, orderNumber);
    DeviceEventEmitter.emit(ORDER_STATUS_POPUP_EVENT, {
      status,
      orderNumber: orderNumber || orderId?.slice(-6) || '',
    });
  } else {
    const channelId =
      type === 'order' ? CHANNEL_ORDER_UPDATES :
      type === 'wallet' ? CHANNEL_WALLET :
      CHANNEL_GENERAL;
    displayLocalNotification(title, body, (data as Record<string, string>) || {}, channelId);
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
  const title = notification?.title || (data?.title as string) || 'Notification';
  const body = notification?.body || (data?.body as string) || '';
  const type = (data?.type as string) || 'system';
  const orderId = data?.orderId as string;
  const status = data?.status as string;
  const orderNumber = data?.orderNumber as string;

  // Dedup
  if (orderId && status) {
    if (isDuplicate(`${orderId}:${status}`)) return;
  } else if (remoteMessage.messageId) {
    if (isDuplicate(remoteMessage.messageId)) return;
  }

  // Create channels (may not exist yet in headless JS context)
  await createChannels();

  // Full-screen notification for all order status changes (background/killed state)
  if (type === 'order' && ['preparing', 'ready', 'completed', 'cancelled'].includes(status)) {
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
async function registerTokenWithBackend(token: string, userId: string): Promise<void> {
  try {
    await api.post('/auth/fcm-token', {
      token,
      deviceId: `${Platform.OS}-${userId}`,
      platform: Platform.OS,
    });
    console.log('[Notifications] FCM token registered with backend');
  } catch (error) {
    console.warn('[Notifications] Failed to register FCM token:', error);
  }
}

// ── Unregister FCM token (called on logout) ─────────────────────
export async function unregisterToken(): Promise<void> {
  try {
    const token = await messaging().getToken();
    if (token) {
      await api.delete('/auth/fcm-token', { data: { token } });
      console.log('[Notifications] FCM token unregistered');
    }
  } catch (error) {
    console.warn('[Notifications] Failed to unregister FCM token:', error);
  }
}

// ── Token refresh listener ──────────────────────────────────────
let tokenRefreshUnsubscribe: (() => void) | null = null;

export function setupTokenRefreshListener(userId: string): void {
  if (tokenRefreshUnsubscribe) {
    tokenRefreshUnsubscribe();
  }
  tokenRefreshUnsubscribe = messaging().onTokenRefresh((newToken) => {
    registerTokenWithBackend(newToken, userId);
  });
}

// ── Initialize everything ───────────────────────────────────────
export async function initializeNotifications(userId: string): Promise<void> {
  try {
    // 1. Request permissions
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!enabled) {
        console.warn('[Notifications] iOS permission not granted');
        return;
      }
    }
    if (Platform.OS === 'android') {
      const settings = await notifee.requestPermission();
      if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
        console.warn('[Notifications] Android permission not granted');
        return;
      }
    }

    // 2. Create notification channels (Android-only, no-op on iOS)
    await createChannels();

    // 3. Get FCM token and register with backend
    const token = await messaging().getToken();
    if (token) {
      await registerTokenWithBackend(token, userId);
    }

    // 4. Set up token refresh listener
    setupTokenRefreshListener(userId);

    console.log('[Notifications] Initialized for user:', userId);
  } catch (error) {
    console.warn('[Notifications] Initialization failed:', error);
  }
}

// ── Cleanup (called on logout or unmount) ───────────────────────
export function cleanupNotifications(): void {
  if (tokenRefreshUnsubscribe) {
    tokenRefreshUnsubscribe();
    tokenRefreshUnsubscribe = null;
  }
}
