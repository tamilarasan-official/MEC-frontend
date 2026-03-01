import { io, Socket } from 'socket.io-client';
import { DeviceEventEmitter } from 'react-native';
import { getAccessToken } from './api';
import { AppDispatch } from '../store';
import { addNotification } from '../store/slices/userSlice';
import { ORDER_STATUS_POPUP_EVENT } from '../constants/events';
import {
  isDuplicate,
  displayLocalNotification,
  CHANNEL_ORDER_UPDATES,
  CHANNEL_WALLET,
  CHANNEL_GENERAL,
} from './notificationService';

// const SOCKET_URL = 'http://192.168.1.8:3030';
const SOCKET_URL = 'https://backend.mec.welocalhost.com';

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
  if (socket?.connected) return socket;
  const token = await getAccessToken();
  if (!token) return null;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
    timeout: 15000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
    socket?.emit('join:user', userId);
    if (['captain', 'owner', 'superadmin'].includes(role) && shopId) {
      socket?.emit('join:shop', shopId);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.warn('[Socket] Connection error:', error.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
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

  // Order status changed
  socket.on('order:status_changed', (payload: OrderUpdatePayload) => {
    const status = payload.status as 'preparing' | 'ready' | 'completed' | 'cancelled';

    // Check AND mark dedup key — skip if FCM already handled this event
    const dedupKey = `${payload.orderId}:${status}`;
    const alreadySeen = isDuplicate(dedupKey);

    // Always show popup (important visual feedback even if FCM was first)
    const isStudentOrEatMode = userRole === 'student' || userMode === 'eat';
    if (isStudentOrEatMode && ['preparing', 'ready', 'completed', 'cancelled'].includes(status)) {
      console.log('[Socket] Emitting ORDER_STATUS_POPUP_EVENT:', status, payload.orderNumber);
      DeviceEventEmitter.emit(ORDER_STATUS_POPUP_EVENT, {
        status,
        orderNumber: payload.orderNumber || payload.orderId.slice(-6),
      });
    }

    // Only add to Redux if not already handled by FCM
    if (!alreadySeen) {
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
    }
  });

  // New order (for staff)
  socket.on('order:new', (payload: { orderId: string; orderNumber: string; total: number; pickupToken?: string }) => {
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

    displayLocalNotification('New Order!', msg, { orderId: payload.orderId }, CHANNEL_ORDER_UPDATES);
  });

  // Wallet updates
  socket.on('wallet:updated', (payload: { type: string; amount: number; balance: number; message: string }) => {
    const titleMap: Record<string, string> = { credit: 'Money Added', debit: 'Money Deducted', refund: 'Refund Received' };
    const title = titleMap[payload.type] || 'Wallet Updated';
    const msg = payload.message || `Rs. ${payload.amount} updated`;
    dispatch(addNotification({
      id: `notif-${Date.now()}`,
      type: 'wallet',
      title,
      message: msg,
      createdAt: new Date().toISOString(),
      read: false,
    }));

    // Only show system notification for credits/refunds (user is in-app for debits)
    if (payload.type !== 'debit') {
      displayLocalNotification(title, msg, { type: payload.type }, CHANNEL_WALLET);
    }
  });

  // Announcements
  socket.on('announcement', (payload: { title: string; message: string }) => {
    dispatch(addNotification({
      id: `notif-${Date.now()}`,
      type: 'announcement',
      title: payload.title,
      message: payload.message,
      createdAt: new Date().toISOString(),
      read: false,
    }));

    displayLocalNotification(payload.title, payload.message, {}, CHANNEL_GENERAL);
  });

  // General notifications
  socket.on('notification', (payload: any) => {
    dispatch(addNotification({
      id: payload.id || `notif-${Date.now()}`,
      type: payload.type || 'system',
      title: payload.title,
      message: payload.message,
      createdAt: payload.createdAt || new Date().toISOString(),
      read: false,
    }));
  });
};

export default { connectSocket, disconnectSocket, getSocket, setupSocketListeners };
