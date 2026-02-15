import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';
import { AppDispatch } from '../store';
import { addNotification, setOrderStatusPopup } from '../store/slices/userSlice';

const SOCKET_URL = 'https://backend.mec.welocalhost.com';

let socket: Socket | null = null;

export interface OrderUpdatePayload {
  orderId: string;
  orderNumber: string;
  status: string;
  previousStatus?: string;
  updatedAt: string;
  notification?: { title: string; body: string };
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
    const isStudentOrEatMode = userRole === 'student' || userMode === 'eat';
    if (isStudentOrEatMode && ['preparing', 'ready', 'completed', 'cancelled'].includes(status)) {
      dispatch(setOrderStatusPopup({ status, orderNumber: payload.orderNumber || payload.orderId.slice(-6) }));
    }

    const statusLabels: Record<string, string> = {
      preparing: 'Your order is being prepared',
      ready: 'Your order is ready for pickup!',
      completed: 'Your order has been completed',
      cancelled: 'Your order has been cancelled',
    };
    dispatch(addNotification({
      id: `notif-${Date.now()}`,
      type: 'order',
      title: payload.notification?.title || `Order #${payload.orderNumber || payload.orderId.slice(-6)}`,
      message: payload.notification?.body || statusLabels[status] || `Status updated to ${status}`,
      data: { orderId: payload.orderId, orderNumber: payload.orderNumber, status },
      createdAt: payload.updatedAt,
      read: false,
    }));
  });

  // New order (for staff)
  socket.on('order:new', (payload: { orderId: string; orderNumber: string; total: number; pickupToken?: string }) => {
    dispatch(addNotification({
      id: `notif-${Date.now()}`,
      type: 'order',
      title: 'New Order!',
      message: `Order #${payload.orderNumber || payload.pickupToken || ''} - Rs. ${payload.total}`,
      data: { orderId: payload.orderId, orderNumber: payload.orderNumber },
      createdAt: new Date().toISOString(),
      read: false,
    }));
  });

  // Wallet updates
  socket.on('wallet:updated', (payload: { type: string; amount: number; balance: number; message: string }) => {
    const titleMap: Record<string, string> = { credit: 'Money Added', debit: 'Money Deducted', refund: 'Refund Received' };
    dispatch(addNotification({
      id: `notif-${Date.now()}`,
      type: 'wallet',
      title: titleMap[payload.type] || 'Wallet Updated',
      message: payload.message || `Rs. ${payload.amount} updated`,
      createdAt: new Date().toISOString(),
      read: false,
    }));
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
