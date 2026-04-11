import { io, Socket } from 'socket.io-client';
import { DeviceEventEmitter } from 'react-native';
import { getAccessToken, refreshAccessTokenSilently, API_ORIGIN } from './api';
import { AppDispatch } from '../store';
import { addNotification, fetchWalletBalance, fetchTransactions, fetchDashboardStats, fetchQRPayments } from '../store/slices/userSlice';
import { fetchMyActiveOrders, fetchActiveShopOrders, patchOrderStatus } from '../store/slices/ordersSlice';
import { updateShopStatus } from '../store/slices/menuSlice';
import { ORDER_STATUS_POPUP_EVENT, FORCE_LOGOUT_EVENT } from '../constants/events';
import {
  isDuplicate,
  displayLocalNotification,
  CHANNEL_ORDER_UPDATES,
  CHANNEL_WALLET,
  CHANNEL_GENERAL,
} from './notificationService';

const SOCKET_URL = API_ORIGIN;

let socket: Socket | null = null;

// force_logout rate limit — only process once every 5 minutes to prevent MITM injection DoS
let lastForceLogoutTs = 0;
const FORCE_LOGOUT_COOLDOWN_MS = 5 * 60 * 1000;

export interface OrderUpdatePayload {
  orderId: string;
  orderNumber: string;
  status: string;
  pickupToken?: string;
  previousStatus?: string;
  updatedAt: string;
  user?: string;
  notification?: { title: string; body: string };
  items?: { name: string; quantity: number; itemStatus?: string; delivered?: boolean }[];
}

export const connectSocket = async (userId: string, role: string, shopId?: string) => {
  // If already connected to the server, reuse the existing socket
  if (socket?.connected) return socket;

  // Clean up any existing socket (disconnected, reconnecting, or stale)
  // to prevent zombie connections from piling up on the server
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const token = await getAccessToken();
  if (!token) return null;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 30000,
    timeout: 15000,
  });

  socket.io.on('reconnect_attempt', async () => {
    // Proactively refresh the access token before reconnecting —
    // the stored token may be expired (15-min TTL) which causes "jwt expired" on socket auth.
    const freshToken = await refreshAccessTokenSilently() ?? await getAccessToken();
    if (freshToken && socket) {
      socket.auth = { token: freshToken };
    }
  });

  socket.on('connect', () => {
    if (__DEV__) console.log('[Socket] Connected:', socket?.id);
    socket?.emit('join:user', userId);
    if (['captain', 'owner', 'superadmin'].includes(role) && shopId) {
      socket?.emit('join:shop', shopId);
    }
  });

  socket.on('disconnect', (reason) => {
    if (__DEV__) console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    if (__DEV__) console.warn('[Socket] Connection error:', error.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const setupSocketListeners = (dispatch: AppDispatch, userRole: string, userMode: string, userId?: string) => {
  if (!socket) return;

  socket.removeAllListeners('connect');
  socket.removeAllListeners('order:status_changed');
  socket.removeAllListeners('order:new');
  socket.removeAllListeners('wallet:updated');
  socket.removeAllListeners('announcement');
  socket.removeAllListeners('notification');
  socket.removeAllListeners('shop:status_changed');
  socket.removeAllListeners('payment:received');
  socket.removeAllListeners('force_logout');

  // On every (re)connect — refetch shop orders for staff so any orders that arrived
  // while the socket was dead (expired token) are loaded immediately.
  socket.on('connect', () => {
    if (userRole !== 'student' && userMode !== 'eat') {
      dispatch(fetchActiveShopOrders());
      dispatch(fetchDashboardStats());
    }
  });

  // Order status changed
  // NOTE: Captain/owner sockets are in BOTH user:userId AND shop:shopId rooms,
  // so the backend emits this event to both rooms — causing this handler to fire
  // twice for the same status change. The dedup guard prevents double popup,
  // double Redux notification, and double order refetch.
  socket.on('order:status_changed', (payload: OrderUpdatePayload) => {
    try {
      const status = payload.status as 'preparing' | 'partially_ready' | 'ready' | 'completed' | 'cancelled';

      // ALWAYS patch Redux immediately so item-level status tags update in real-time
      // (e.g. 2nd item marked ready while order is still partially_ready).
      // This must happen BEFORE dedup check — dedup only gates notifications/popups.
      dispatch(patchOrderStatus({ orderId: payload.orderId, status, items: payload.items }));

      // Determine if this is the current user's own order (personal/eat-mode order)
      const isOwnOrder = userId && payload.user && String(payload.user) === String(userId);

      // Re-fetch orders so the UI reflects the new status immediately
      if (userRole === 'student' || userMode === 'eat' || isOwnOrder) {
        dispatch(fetchMyActiveOrders());
        if (status === 'cancelled' || status === 'completed') {
          dispatch(fetchWalletBalance());
        }
      }
      // Staff in work mode: always refresh shop orders too
      if (userRole !== 'student' && userMode !== 'eat') {
        dispatch(fetchActiveShopOrders());
        dispatch(fetchDashboardStats());
      }

      // Dedup: only skip notification + popup if this orderId+status was already processed
      // (from the other room delivery, or from FCM arriving first).
      // Redux patch + refetch above always run regardless.
      const dedupKey = `${payload.orderId}:${status}`;
      if (isDuplicate(dedupKey)) return;

      // Show popup for: students, eat-mode users, OR any user's own order
      // (captain/owner in work mode should still see popup for their personal orders)
      const shouldShowPopup = userRole === 'student' || userMode === 'eat' || isOwnOrder;
      if (shouldShowPopup && ['preparing', 'partially_ready', 'ready', 'completed', 'cancelled'].includes(status)) {
        if (__DEV__) console.log('[Socket] Emitting ORDER_STATUS_POPUP_EVENT:', status, payload.orderNumber);
        const popupItemNames = (payload.items || []).map(i => i.name).filter(Boolean);
        DeviceEventEmitter.emit(ORDER_STATUS_POPUP_EVENT, {
          status,
          orderNumber: payload.orderNumber || payload.orderId.slice(-6),
          pickupToken: payload.pickupToken,
          itemNames: popupItemNames,
        });
      }

      // Add to Redux notification list
      const itemNames = (payload.items || []).map(i => i.name).filter(Boolean);
      const itemsSuffix = itemNames.length > 0 ? ` (${itemNames.join(', ')})` : '';
      const statusLabels: Record<string, string> = {
        preparing: `Your order is being prepared${itemsSuffix}`,
        partially_ready: `Some items from your order are ready for pickup!${itemsSuffix}`,
        ready: `Your order is ready for pickup!${itemsSuffix}`,
        completed: `Your order has been completed${itemsSuffix}`,
        cancelled: `Your order has been cancelled${itemsSuffix}`,
      };
      const orderNum = payload.orderNumber || payload.orderId.slice(-6);
      const title = payload.notification?.title || `Order #${orderNum}`;
      const message = payload.notification?.body || statusLabels[status] || `Status updated to ${status}`;

      dispatch(addNotification({
        id: `notif-${Date.now()}`,
        type: 'order',
        title,
        message,
        data: { orderId: payload.orderId, orderNumber: payload.orderNumber, status, pickupToken: payload.pickupToken },
        createdAt: payload.updatedAt,
        read: false,
      }));
    } catch (e) {
      if (__DEV__) console.warn('[Socket] Error in order:status_changed handler:', e);
    }
  });

  // New order (for staff)
  socket.on('order:new', (payload: { orderId: string; orderNumber: string; total: number; pickupToken?: string }) => {
    try {
      // Check AND mark dedup key — skip if FCM already handled this event
      const alreadySeen = isDuplicate(`${payload.orderId}:new`);
      if (alreadySeen) return;

      const msg = `Order #${payload.orderNumber || payload.pickupToken || ''} - Rs. ${payload.total}`;
      dispatch(addNotification({
        id: `notif-${Date.now()}`,
        type: 'order',
        title: 'New Order!',
        message: msg,
        data: { orderId: payload.orderId, orderNumber: payload.orderNumber },
        createdAt: new Date().toISOString(),
        read: false,
      }));

      // Refetch order list + dashboard stats so new order appears immediately
      if (userRole !== 'student' || userMode === 'work') {
        dispatch(fetchActiveShopOrders());
        dispatch(fetchDashboardStats());
      }

      displayLocalNotification('New Order!', msg, { orderId: payload.orderId }, CHANNEL_ORDER_UPDATES, `new-order-${payload.orderId}`);
    } catch (e) {
      if (__DEV__) console.warn('[Socket] Error in order:new handler:', e);
    }
  });

  // Wallet updates
  socket.on('wallet:updated', (payload: { type: string; amount: number; balance: number; message: string }) => {
    try {
      const titleMap: Record<string, string> = { credit: 'Money Added', debit: 'Money Deducted', refund: 'Refund Received' };
      const title = titleMap[payload.type] || 'Wallet Updated';
      const msg = payload.message || `Rs. ${payload.amount} updated`;

      // Dedup: use the same key format as FCM handler (10-second window)
      // so socket and FCM don't both show a notification for the same event
      const dedupKey = `wallet:credit:${payload.amount}:${Math.floor(Date.now() / 10000)}`;
      if (isDuplicate(dedupKey)) {
        // Still refresh balance even if notification is deduped
        dispatch(fetchWalletBalance());
        return;
      }

      dispatch(addNotification({
        id: `notif-${Date.now()}`,
        type: 'wallet',
        title,
        message: msg,
        createdAt: new Date().toISOString(),
        read: false,
      }));

      // Auto-refresh balance + transaction history immediately
      dispatch(fetchWalletBalance());
      dispatch(fetchTransactions());

      // Only show system notification for credits/refunds (user is in-app for debits)
      // Use a fixed Notifee notification ID so duplicate wallet notifications
      // replace each other in the tray instead of stacking
      if (payload.type !== 'debit') {
        displayLocalNotification(title, msg, { type: payload.type }, CHANNEL_WALLET, `wallet-${payload.type}`);
      }
    } catch (e) {
      if (__DEV__) console.warn('[Socket] Error in wallet:updated handler:', e);
    }
  });

  // Announcements
  socket.on('announcement', (payload: { title: string; message: string }) => {
    try {
      // Reject empty announcements
      if ((!payload.title || !payload.title.trim()) && (!payload.message || !payload.message.trim())) return;

      // Dedup announcements by content (prevents duplicate on socket reconnect)
      const dedupKey = `announce:${payload.title}:${Math.floor(Date.now() / 60000)}`;
      if (isDuplicate(dedupKey)) return;

      dispatch(addNotification({
        id: `notif-${Date.now()}`,
        type: 'announcement',
        title: payload.title,
        message: payload.message,
        createdAt: new Date().toISOString(),
        read: false,
      }));

      displayLocalNotification(payload.title, payload.message, {}, CHANNEL_GENERAL, `announce-${Date.now()}`);
    } catch (e) {
      if (__DEV__) console.warn('[Socket] Error in announcement handler:', e);
    }
  });

  // General notifications
  socket.on('notification', (payload: any) => {
    if (
      !payload ||
      typeof payload.title !== 'string' ||
      typeof payload.message !== 'string'
    ) {
      if (__DEV__) console.warn('[Socket] Invalid notification payload, skipping');
      return;
    }
    const title = payload.title.slice(0, 200);
    const message = payload.message.slice(0, 1000);

    // Skip empty notifications
    if (!title.trim() && !message.trim()) return;

    // Dedup generic notifications by content
    const dedupKey = `notif:${title}:${message}:${Math.floor(Date.now() / 30000)}`;
    if (isDuplicate(dedupKey)) return;

    dispatch(addNotification({
      id: payload.id || `notif-${Date.now()}`,
      type: payload.type || 'system',
      title,
      message,
      createdAt: payload.createdAt || new Date().toISOString(),
      read: false,
    }));
  });

  // Shop status changes — update shop isActive in Redux so UI reflects closed shops
  socket.on('shop:status_changed', (payload: { shopId: string; isActive: boolean }) => {
    try {
      if (!payload?.shopId || typeof payload.isActive !== 'boolean') return;
      if (__DEV__) console.log('[Socket] Shop status changed:', payload.shopId, payload.isActive);
      dispatch(updateShopStatus({ shopId: payload.shopId, isActive: payload.isActive }));
    } catch (e) {
      if (__DEV__) console.warn('[Socket] Error in shop:status_changed handler:', e);
    }
  });

  // Payment received — refresh QR payments on stationery dashboard + show notification
  socket.on('payment:received', (payload: {
    paymentRequestId: string;
    title: string;
    amount: number;
    studentName: string;
    totalCollected: number;
    paidCount: number;
  }) => {
    try {
      // Validate required payload fields
      if (!payload || !payload.paymentRequestId || !payload.amount || !payload.studentName) return;

      // Dedup: prevent duplicate payment notifications (socket reconnect + FCM)
      // Uses paymentRequestId so both socket and FCM handlers share the same key
      if (isDuplicate(`payment:${payload.paymentRequestId}`)) return;

      if (__DEV__) console.log('[Socket] Payment received:', payload);

      const title = 'Payment Received';
      const msg = `Rs. ${payload.amount} collected for "${payload.title}" from ${payload.studentName}`;

      dispatch(addNotification({
        id: `notif-${Date.now()}`,
        type: 'wallet',
        title,
        message: msg,
        createdAt: new Date().toISOString(),
        read: false,
      }));

      // Refresh QR payments so dashboard shows updated collected amount
      dispatch(fetchQRPayments());
      // Also refresh wallet balance + orders in case payment is linked to an order
      dispatch(fetchWalletBalance());
      dispatch(fetchActiveShopOrders());
      dispatch(fetchDashboardStats());

      // Show local notification for shop staff
      displayLocalNotification(title, msg, { paymentRequestId: payload.paymentRequestId }, CHANNEL_WALLET, `payment-${payload.paymentRequestId}`);
    } catch (e) {
      if (__DEV__) console.warn('[Socket] Error in payment:received handler:', e);
    }
  });

  // Force logout — another device logged in with this account
  // Guards: payload validation + timestamp freshness + rate limit (prevents MITM DoS injection)
  socket.on('force_logout', (payload: { reason: string; ts?: number }) => {
    const now = Date.now();

    // 1. Validate payload structure
    if (!payload || typeof payload.reason !== 'string' || !payload.reason.trim()) {
      if (__DEV__) console.warn('[Socket] force_logout rejected: invalid payload');
      return;
    }

    // 2. If server includes a timestamp, reject stale events (> 60 seconds old)
    //    This requires the backend to include `ts: Date.now()` in the event payload
    if (payload.ts !== undefined) {
      if (typeof payload.ts !== 'number' || Math.abs(now - payload.ts) > 60_000) {
        if (__DEV__) console.warn('[Socket] force_logout rejected: stale timestamp');
        return;
      }
    }

    // 3. Rate limit: only process one force_logout per 5 minutes (prevents injection loop DoS)
    if (now - lastForceLogoutTs < FORCE_LOGOUT_COOLDOWN_MS) {
      if (__DEV__) console.warn('[Socket] force_logout rate-limited, ignoring duplicate');
      return;
    }
    lastForceLogoutTs = now;

    if (__DEV__) console.log('[Socket] Force logout received:', payload.reason);
    DeviceEventEmitter.emit(FORCE_LOGOUT_EVENT, { reason: payload.reason });
  });
};

export default { connectSocket, disconnectSocket, getSocket, setupSocketListeners };
