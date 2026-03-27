import {
  getMessaging,
  getToken,
  getAPNSToken,
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
import api from './api';
import { getDeviceId } from '../store/slices/authSlice';
import { AppDispatch } from '../store';
import { addNotification, fetchWalletBalance } from '../store/slices/userSlice';
import { fetchMyActiveOrders, fetchMyOrders, fetchActiveShopOrders } from '../store/slices/ordersSlice';
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
  itemsSummary?: string,
): Promise<void> {
  const body = itemsSummary
    ? `Your ${itemsSummary} is ready for pickup!`
    : `Order #${orderNumber} is ready for pickup!`;
  await notifee.displayNotification({
    title: itemsSummary || 'Order Ready for Pickup!',
    body,
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
    ios: {
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
      },
      sound: 'default',
      interruptionLevel: 'timeSensitive',
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
    ios: {
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
      },
      sound: 'default',
      interruptionLevel: 'timeSensitive',
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
    ios: {
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
      },
      sound: 'default',
    },
  });
}

// ── Work-related FCM notification types ──────────────────────────
// These are shop/staff notifications that should be suppressed when
// a captain or owner is in eat mode (acting as a customer).
const WORK_NOTIFICATION_TYPES = new Set([
  'new_order', 'order_new', 'payment', 'payment_received',
  'shop_status', 'shop',
]);

function isWorkNotification(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const type = (data.type as string || '').toLowerCase();
  if (WORK_NOTIFICATION_TYPES.has(type)) return true;
  // New orders often arrive as type 'order' with status 'new' or 'pending'
  if (type === 'order' && ['new', 'pending'].includes((data.status as string || '').toLowerCase())) return true;
  return false;
}

// ── Handle foreground FCM message ───────────────────────────────
export function handleForegroundMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  dispatch: AppDispatch,
  userRole?: string,
  userMode?: string,
): void {
  const { data, notification } = remoteMessage;
  const title = notification?.title || (data?.title as string) || '';
  const body = notification?.body || (data?.body as string) || '';

  // Skip if there's no meaningful content to display
  if (!title.trim() && !body.trim()) return;

  // Suppress work-related notifications when captain/owner is in eat mode
  if (userMode === 'eat' && (userRole === 'captain' || userRole === 'owner') && isWorkNotification(data)) {
    if (__DEV__) console.log('[FCM] Suppressing work notification in eat mode:', data?.type);
    return;
  }

  const type = (data?.type as string) || 'system';
  const orderId = data?.orderId as string;
  const status = data?.status as string;
  const orderNumber = data?.orderNumber as string;

  // Dedup: skip if already shown (e.g. socket delivered first, or duplicate FCM tokens)
  // Use content-based key so duplicate FCM messages (from stale tokens) are caught
  if (orderId && status) {
    const itemNamesStr = data?.itemNames as string;
    const orderDedupKey = itemNamesStr && status === 'item_ready' ? `${orderId}:${status}:${itemNamesStr}` : `${orderId}:${status}`;
    if (isDuplicate(orderDedupKey)) return;
  } else if (type === 'wallet_credit' || type === 'wallet' || type === 'wallet_debit') {
    const txId = (data?.transactionId as string) || '';
    const walletDedupKey = txId ? `wallet:tx:${txId}` : `wallet:credit:${data?.amount || ''}:${Math.floor(Date.now() / 10000)}`;
    if (isDuplicate(walletDedupKey)) {
      // Still refresh wallet balance even if notification is deduped
      dispatch(fetchWalletBalance());
      return;
    }
  } else if (type === 'payment_received') {
    const txId = (data?.transactionId as string) || '';
    const prDedupKey = txId ? `pr:tx:${txId}` : `pr:${data?.paymentRequestId || ''}:${Math.floor(Date.now() / 10000)}`;
    if (isDuplicate(prDedupKey)) return;
  } else {
    // Content-based dedup for all other notifications (prevents duplicates from stale FCM tokens)
    const contentKey = `${type}:${title}:${body}:${Math.floor(Date.now() / 30000)}`;
    if (isDuplicate(contentKey)) return;
  }

  // Auto-refresh wallet balance when receiving wallet notifications via FCM
  // (covers cases where the socket missed the wallet:updated event)
  if (type === 'wallet_credit' || type === 'wallet' || type === 'wallet_debit') {
    dispatch(fetchWalletBalance());
  }

  // Re-fetch orders so UI reflects the new status (covers cases where
  // the socket event gets deduped because FCM arrived first)
  if (type === 'order' && status) {
    if (userRole === 'student' || userMode === 'eat') {
      dispatch(fetchMyActiveOrders());
      dispatch(fetchMyOrders());
    } else if (userRole === 'captain' || userRole === 'owner') {
      dispatch(fetchActiveShopOrders());
    }
  }

  // Determine channel and display strategy
  if (type === 'order' && ['preparing', 'partially_ready', 'ready', 'partially_delivered', 'completed', 'cancelled'].includes(status)) {
    const itemNamesRaw = data?.itemNames as string;
    const itemNamesList = itemNamesRaw ? itemNamesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const itemsSummary = itemNamesList.join(', ');
    const pickupToken = (data?.pickupToken as string) || '';

    // Emit full-screen popup event
    if (__DEV__) console.log('[FCM] Emitting ORDER_STATUS_POPUP_EVENT:', status, orderNumber, itemNamesList);
    DeviceEventEmitter.emit(ORDER_STATUS_POPUP_EVENT, {
      status,
      orderNumber: orderNumber || orderId?.slice(-6) || '',
      itemNames: itemNamesList,
      pickupToken,
    });

    // Build notification text with food item names + pickup token
    const statusMessages: Record<string, string> = {
      preparing: itemsSummary ? `Your ${itemsSummary} is being prepared!` : 'Your order is being prepared!',
      partially_ready: itemsSummary ? `Your ${itemsSummary} is ready for pickup!` : 'Some items are ready for pickup!',
      partially_delivered: 'Some items have been handed over. Remaining items coming soon!',
      ready: itemsSummary ? `Your ${itemsSummary} is ready for pickup!` : 'All items are ready for pickup!',
      completed: itemsSummary ? `Your ${itemsSummary} has been delivered. Enjoy!` : 'Your order has been delivered!',
      cancelled: itemsSummary ? `Your ${itemsSummary} has been cancelled.` : 'Your order has been cancelled.',
    };
    const notifTitle = itemsSummary || title || `Order #${orderNumber || orderId?.slice(-6) || ''}`;
    const notifBody = (statusMessages[status] || body) + (pickupToken ? ` • Pickup ID: ${pickupToken}` : '');

    // Show a local notification so the user sees food items + pickup token
    // (the system APN banner uses the backend's generic text)
    const channelId = ['ready', 'partially_ready', 'partially_delivered'].includes(status) ? CHANNEL_ORDER_READY : CHANNEL_ORDER_UPDATES;
    displayLocalNotification(notifTitle, notifBody, { orderId: orderId || '', status, pickupToken }, channelId, `order-${orderId}-${status}`);

    // Dispatch to Redux for in-app notification list
    dispatch(addNotification({
      id: remoteMessage.messageId || `fcm-${Date.now()}`,
      title: notifTitle,
      message: notifBody,
      type: 'order',
      read: false,
      createdAt: new Date().toISOString(),
      data: { orderId, orderNumber, status, pickupToken, itemNames: itemsSummary },
    }));
  } else {
    const channelId =
      type === 'order' ? CHANNEL_ORDER_UPDATES :
      type === 'wallet' ? CHANNEL_WALLET :
      CHANNEL_GENERAL;
    const itemNamesStr = data?.itemNames as string;
    const notifId = orderId ?
      (status === 'item_ready' && itemNamesStr ? `order-${orderId}-${status}-${itemNamesStr}` : `order-${orderId}-${status}`) :
      (type === 'wallet_credit' || type === 'wallet' || type === 'wallet_debit') ? `wallet-${(data?.transactionId as string) || Date.now()}` :
      (type === 'payment_received') ? `pr-${(data?.transactionId as string) || Date.now()}` :
      undefined;
    displayLocalNotification(title, body, (data as Record<string, string>) || {}, channelId, notifId);

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
    const itemNamesStr = data?.itemNames as string;
    const orderDedupKey = itemNamesStr && status === 'item_ready' ? `${orderId}:${status}:${itemNamesStr}` : `${orderId}:${status}`;
    if (isDuplicate(orderDedupKey)) return;
  } else if (type === 'wallet_credit' || type === 'wallet' || type === 'wallet_debit') {
    const txId = (data?.transactionId as string) || '';
    const walletDedupKey = txId ? `wallet:tx:${txId}` : `wallet:credit:${data?.amount || ''}:${Math.floor(Date.now() / 60000)}`;
    if (isDuplicate(walletDedupKey)) return;
  } else if (type === 'payment_received') {
    const txId = (data?.transactionId as string) || '';
    const prDedupKey = txId ? `pr:tx:${txId}` : `pr:${data?.paymentRequestId || ''}:${Math.floor(Date.now() / 60000)}`;
    if (isDuplicate(prDedupKey)) return;
  } else if (remoteMessage.messageId) {
    if (isDuplicate(remoteMessage.messageId)) return;
  }

  // Create channels (may not exist yet in headless JS context)
  await createChannels();

  // Full-screen notification for all order status changes (background/killed state)
  if (type === 'order' && ['preparing', 'partially_ready', 'ready', 'partially_delivered', 'completed', 'cancelled'].includes(status)) {
    await displayOrderStatusFullScreen(title, body, orderNumber || '', orderId || '', status);
  } else {
    const channelId =
      type === 'order' ? CHANNEL_ORDER_UPDATES :
      type === 'wallet' ? CHANNEL_WALLET :
      CHANNEL_GENERAL;
    const itemNamesStr = data?.itemNames as string;
    const notifId = orderId ? 
      (status === 'item_ready' && itemNamesStr ? `order-${orderId}-${status}-${itemNamesStr}` : `order-${orderId}-${status}`) :
      (type === 'wallet_credit' || type === 'wallet' || type === 'wallet_debit') ? `wallet-${(data?.transactionId as string) || Date.now()}` :
      (type === 'payment_received') ? `pr-${(data?.transactionId as string) || Date.now()}` :
      undefined;
    await displayLocalNotification(title, body, (data as Record<string, string>) || {}, channelId, notifId);
  }
  // No Redux dispatch here — store is not available in background/headless JS
}

// ── iOS APNs Token Helper ─────────────────────────────────────────
async function getIosApnsToken(): Promise<string | null> {
  // In production (TestFlight), the APNs token might not be immediately available.
  // First, getting the FCM token forces Firebase to wait for the APNs token under the hood.
  try { await getToken(getMessaging()); } catch { /* ignore */ }
  
  let apnsToken = await getAPNSToken(getMessaging());
  
  // Fallback polling if still null
  let retries = 5;
  while (!apnsToken && retries > 0) {
    if (__DEV__) console.log('[Notifications] Waiting for APNs token...', retries, 'retries left');
    await new Promise(resolve => setTimeout(() => resolve(null), 1000));
    apnsToken = await getAPNSToken(getMessaging());
    retries--;
  }
  return apnsToken;
}

// ── Register FCM token with backend ─────────────────────────────
async function registerTokenWithBackend(token: string, _userId: string): Promise<void> {
  try {
    const { getCurrentVersion } = require('./versionService');
    const deviceId = await getDeviceId();
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

// ── Unregister device token (called on logout) ─────────────────
export async function unregisterToken(): Promise<void> {
  try {
    // iOS: use APNs token (matches what was registered)
    // Android: use FCM token
    let token: string | null = null;
    if (Platform.OS === 'ios') {
      token = await getIosApnsToken();
    } else {
      token = await getToken(getMessaging());
    }
    if (token) {
      await api.delete('/auth/fcm-token', { data: { token } });
      if (__DEV__) console.log('[Notifications] Device token unregistered');
    }
  } catch (error) {
    // Fallback: try to unregister by deviceId so the token doesn't linger
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        await api.delete('/auth/fcm-token', { data: { deviceId } });
      }
    } catch { /* ignore fallback failure */ }
    if (__DEV__) console.warn('[Notifications] Failed to unregister device token:', error);
  }
}

// ── Token refresh listener ──────────────────────────────────────
let tokenRefreshUnsubscribe: (() => void) | null = null;

export function setupTokenRefreshListener(userId: string): void {
  if (tokenRefreshUnsubscribe) {
    tokenRefreshUnsubscribe();
  }
  tokenRefreshUnsubscribe = onTokenRefresh(getMessaging(), async () => {
    // onTokenRefresh fires when FCM token changes.
    // iOS: re-fetch the APNs device token (backend uses direct APNs)
    // Android: use the new FCM token directly
    let token: string | null = null;
    if (Platform.OS === 'ios') {
      token = await getIosApnsToken();
    } else {
      token = await getToken(getMessaging());
    }
    if (token) {
      registerTokenWithBackend(token, userId);
    }
  });
}

// ── Initialize everything ───────────────────────────────────────
export async function initializeNotifications(userId: string): Promise<void> {
  try {
    // 1. Request permissions
    if (Platform.OS === 'ios') {
      const authStatus = await requestPermission(getMessaging());
      const enabled =
        authStatus === FBAuthorizationStatus.AUTHORIZED ||
        authStatus === FBAuthorizationStatus.PROVISIONAL;
      if (!enabled) {
        if (__DEV__) console.warn('[Notifications] iOS permission not granted');
        return;
      }
    }
    if (Platform.OS === 'android') {
      const settings = await notifee.requestPermission();
      if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
        if (__DEV__) console.warn('[Notifications] Android permission not granted');
        return;
      }
    }

    // 2. Create notification channels (Android-only, no-op on iOS)
    await createChannels();

    // 3. Get device token and register with backend
    // iOS: Use APNs device token (backend sends direct APNs, not via FCM)
    // Android: Use FCM token (backend sends via FCM)
    let token: string | null = null;
    if (Platform.OS === 'ios') {
      token = await getIosApnsToken();
    } else {
      token = await getToken(getMessaging());
    }
    if (token) {
      await registerTokenWithBackend(token, userId);
    }

    // 4. Set up token refresh listener
    setupTokenRefreshListener(userId);

    if (__DEV__) console.log('[Notifications] Initialized for user:', userId);
  } catch (error) {
    if (__DEV__) console.warn('[Notifications] Initialization failed:', error);
  }
}

// ── Cleanup (called on logout or unmount) ───────────────────────
export function cleanupNotifications(): void {
  if (tokenRefreshUnsubscribe) {
    tokenRefreshUnsubscribe();
    tokenRefreshUnsubscribe = null;
  }
}
