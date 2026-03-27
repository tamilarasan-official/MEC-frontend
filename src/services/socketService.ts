import { io, Socket } from 'socket.io-client';
import { DeviceEventEmitter } from 'react-native';
import { getAccessToken, API_ORIGIN } from './api';
import { AppDispatch } from '../store';
import { addNotification, fetchWalletBalance, fetchQRPayments } from '../store/slices/userSlice';
import { fetchMyActiveOrders, fetchMyOrders, fetchActiveShopOrders } from '../store/slices/ordersSlice';
import { updateShopStatus } from '../store/slices/menuSlice';
import { ORDER_STATUS_POPUP_EVENT } from '../constants/events';
import {
  isDuplicate,
  displayLocalNotification,
  CHANNEL_ORDER_READY,
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
  pickupToken?: string;
  notification?: { title: string; body: string };
  items?: { name: string; quantity: number }[];
}

export const connectSocket = async (userId: string, role: string, shopId?: string, userMode: string = 'work') => {
  // If already connected to the server, reuse the existing socket
  if (socket?.connected) return socket;

  // Clean up any existing socket (disconnected, reconnecting, or stale)
  // to prevent zombie connections from piling up on the server
  if (socket) {
    socket.io.removeAllListeners();
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
    } else if (socket) {
      // Token expired / unavailable — stop reconnecting with stale credentials
      if (__DEV__) console.warn('[Socket] No valid token on reconnect, disconnecting');
      socket.disconnect();
    }
  });

  socket.on('connect', () => {
    if (__DEV__) console.log('[Socket] Connected:', socket?.id);
    socket?.emit('join:user', userId);
    // Only join shop room in work mode — eat mode users are customers,
    // they shouldn't receive shop notifications (new orders, status changes)
    if (userMode !== 'eat' && ['captain', 'owner', 'superadmin'].includes(role) && shopId) {
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
    socket.io.removeAllListeners();
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
      const status = payload.status as 'preparing' | 'partially_ready' | 'ready' | 'partially_delivered' | 'completed' | 'cancelled';

      // Always re-fetch orders so UI reflects the new status — even if popup/notification
      // was already shown by FCM. Fetch both active orders (for Dashboard) and all
      // orders (for Orders page) so every screen updates in real-time.
      if (userRole === 'student' || userMode === 'eat') {
        dispatch(fetchMyActiveOrders());
        dispatch(fetchMyOrders());
      } else {
        dispatch(fetchActiveShopOrders());
      }

      // Dedup: skip popup/notification if this orderId+status was already processed
      // (from the other room delivery, or from FCM arriving first)
      const dedupKey = `${payload.orderId}:${status}`;
      if (isDuplicate(dedupKey)) return;

      // Show popup for students and eat-mode users (captain/owner ordering food)
      const isStudentOrEatMode = userRole === 'student' || userMode === 'eat';
      const itemNames = (payload.items || []).map(i => i.name).filter(Boolean);
      const itemsSummary = itemNames.length > 0 ? itemNames.join(', ') : '';

      if (isStudentOrEatMode && ['preparing', 'partially_ready', 'ready', 'partially_delivered', 'completed', 'cancelled'].includes(status)) {
        if (__DEV__) console.log('[Socket] Emitting ORDER_STATUS_POPUP_EVENT:', status, payload.orderNumber, itemNames);
        DeviceEventEmitter.emit(ORDER_STATUS_POPUP_EVENT, {
          status,
          orderNumber: payload.orderNumber || payload.orderId.slice(-6),
          itemNames,
          pickupToken: payload.pickupToken || '',
        });
      }

      // Only show order status notifications to the customer (student or eat-mode user)
      // Captain/owner in work mode manages orders — they don't need "Your order is completed" messages
      if (isStudentOrEatMode) {
        const statusLabels: Record<string, string> = {
          preparing: itemsSummary
            ? `Your ${itemsSummary} is being prepared!`
            : 'Your order is being prepared!',
          partially_ready: itemNames.length > 0
            ? `${itemsSummary} ready for pickup!`
            : 'Some items are ready for partial pickup!',
          partially_delivered: 'Some items have been handed over. Remaining items coming soon!',
          ready: itemsSummary
            ? `Your ${itemsSummary} is ready for pickup!`
            : 'All items are ready for pickup!',
          completed: itemsSummary
            ? `Your ${itemsSummary} has been delivered. Enjoy!`
            : 'Your order has been completed!',
          cancelled: itemsSummary
            ? `Your ${itemsSummary} has been cancelled.`
            : 'Your order has been cancelled.',
        };
        const notifTitle = payload.notification?.title || (itemsSummary || `Order #${payload.orderNumber || payload.orderId.slice(-6)}`);
        const pickupToken = payload.pickupToken || '';
        const statusMsg = statusLabels[status] || `Status updated to ${status}`;
        const notifMessage = payload.notification?.body || (statusMsg + (pickupToken ? ` • Pickup ID: ${pickupToken}` : ''));

        dispatch(addNotification({
          id: `notif-${Date.now()}`,
          type: 'order',
          title: notifTitle,
          message: notifMessage,
          data: { orderId: payload.orderId, orderNumber: payload.orderNumber, status, pickupToken, itemNames: itemsSummary },
          createdAt: payload.updatedAt,
          read: false,
        }));

        const channelId = (status === 'ready' || status === 'partially_ready' || status === 'partially_delivered') ? CHANNEL_ORDER_READY : CHANNEL_ORDER_UPDATES;
        displayLocalNotification(notifTitle, notifMessage, { orderId: payload.orderId, status, pickupToken }, channelId);
      }
    } catch (e) {
      if (__DEV__) console.warn('[Socket] Error in order:status_changed handler:', e);
    }
  });

  // New order (for staff)
  socket.on('order:new', (payload: { orderId: string; orderNumber: string; total: number; pickupToken?: string }) => {
    try {
      // Eat-mode users are customers — they shouldn't receive shop order notifications
      if (userMode === 'eat') return;

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

      // Re-fetch orders so the UI reflects the new order immediately
      dispatch(fetchActiveShopOrders());

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
      // Eat-mode users are customers — they shouldn't receive payment notifications for their shop
      if (userMode === 'eat') return;

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
