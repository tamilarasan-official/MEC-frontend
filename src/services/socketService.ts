import { io, Socket } from 'socket.io-client';
import { DeviceEventEmitter } from 'react-native';
import { getAccessToken, API_ORIGIN } from './api';
import { AppDispatch } from '../store';
import { addNotification, fetchWalletBalance, fetchQRPayments } from '../store/slices/userSlice';
import { fetchMyActiveOrders, fetchActiveShopOrders } from '../store/slices/ordersSlice';
import { updateShopStatus } from '../store/slices/menuSlice';
import { ORDER_STATUS_POPUP_EVENT } from '../constants/events';
import {
  isDuplicate,
  displayLocalNotification,
  CHANNEL_ORDER_UPDATES,
  CHANNEL_WALLET,
  CHANNEL_GENERAL,
} from './notificationService';

const SOCKET_URL = API_ORIGIN;

let socket: Socket | null = null;

export interface OrderUpdatePayload {
  orderId: string;
  orderNumber: string;
  status: string;
  previousStatus?: string;
  updatedAt: string;
  notification?: { title: string; body: string };
  items?: { name: string; quantity: number }[];
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
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 30000,
    timeout: 15000,
  });

  socket.io.on('reconnect_attempt', async () => {
    const freshToken = await getAccessToken();
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

export const setupSocketListeners = (dispatch: AppDispatch, userRole: string, userMode: string) => {
  if (!socket) return;

  socket.removeAllListeners('order:status_changed');
  socket.removeAllListeners('order:new');
  socket.removeAllListeners('wallet:updated');
  socket.removeAllListeners('announcement');
  socket.removeAllListeners('notification');
  socket.removeAllListeners('shop:status_changed');
  socket.removeAllListeners('payment:received');

  // Order status changed
  // NOTE: Captain/owner sockets are in BOTH user:userId AND shop:shopId rooms,
  // so the backend emits this event to both rooms — causing this handler to fire
  // twice for the same status change. The dedup guard prevents double popup,
  // double Redux notification, and double order refetch.
  socket.on('order:status_changed', (payload: OrderUpdatePayload) => {
    try {
      const status = payload.status as 'preparing' | 'ready' | 'completed' | 'cancelled';

      // Dedup: skip entirely if this orderId+status was already processed
      // (from the other room delivery, or from FCM arriving first)
      const dedupKey = `${payload.orderId}:${status}`;
      if (isDuplicate(dedupKey)) return;

      // Show popup for students and eat-mode users (captain/owner ordering food)
      const isStudentOrEatMode = userRole === 'student' || userMode === 'eat';
      if (isStudentOrEatMode && ['preparing', 'ready', 'completed', 'cancelled'].includes(status)) {
        if (__DEV__) console.log('[Socket] Emitting ORDER_STATUS_POPUP_EVENT:', status, payload.orderNumber);
        DeviceEventEmitter.emit(ORDER_STATUS_POPUP_EVENT, {
          status,
          orderNumber: payload.orderNumber || payload.orderId.slice(-6),
        });
      }

      // Add to Redux notification list
      const itemNames = (payload.items || []).map(i => i.name).filter(Boolean);
      const itemsSuffix = itemNames.length > 0 ? ` (${itemNames.join(', ')})` : '';
      const statusLabels: Record<string, string> = {
        preparing: `Your order is being prepared${itemsSuffix}`,
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
        data: { orderId: payload.orderId, orderNumber: payload.orderNumber, status },
        createdAt: payload.updatedAt,
        read: false,
      }));

      // Re-fetch orders so the UI reflects the new status immediately
      if (userRole === 'student' || userMode === 'eat') {
        dispatch(fetchMyActiveOrders());
      } else {
        dispatch(fetchActiveShopOrders());
      }
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

      // Auto-refresh balance immediately
      dispatch(fetchWalletBalance());

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

      // Dedup: prevent duplicate payment notifications on socket reconnect
      const dedupKey = `payment:${payload.paymentRequestId}:${payload.paidCount}`;
      if (isDuplicate(dedupKey)) return;

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

      // Show local notification for shop staff
      displayLocalNotification(title, msg, { paymentRequestId: payload.paymentRequestId }, CHANNEL_WALLET, `payment-${payload.paymentRequestId}`);
    } catch (e) {
      if (__DEV__) console.warn('[Socket] Error in payment:received handler:', e);
    }
  });
};

export default { connectSocket, disconnectSocket, getSocket, setupSocketListeners };
