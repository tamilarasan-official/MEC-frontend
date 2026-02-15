import api from './api';
import { Order, CartItem, OrderStatus, LaundryDetails, StationeryDetails } from '../types';

// ---- API → Frontend mappers ----
// The backend returns `shop` as a populated object and `user` as string or object.
// Items have `imageUrl` instead of `image`, and `foodItem` as a nested reference.

const mapOrderItem = (item: any): CartItem => ({
  id: item.foodItem?.id || item.foodItem?._id || item._id || '',
  name: item.name || item.foodItem?.name || '',
  description: item.foodItem?.description || '',
  price: item.price ?? item.foodItem?.price ?? 0,
  image: item.imageUrl || item.foodItem?.imageUrl || item.image || '',
  category: item.category || item.foodItem?.category || '',
  shopId: '',
  isAvailable: true,
  isVeg: item.foodItem?.isVeg,
  offerPrice: item.foodItem?.isOfferActive ? item.foodItem?.offerPrice : undefined,
  quantity: item.quantity ?? 1,
  delivered: item.delivered ?? false,
});

const mapOrder = (raw: any): Order => ({
  id: raw.id || raw._id,
  userId: typeof raw.user === 'string' ? raw.user : raw.user?.id || raw.user?._id || '',
  userName: typeof raw.user === 'object' ? raw.user?.name || '' : '',
  items: Array.isArray(raw.items) ? raw.items.map(mapOrderItem) : [],
  total: raw.total ?? 0,
  shopId: typeof raw.shop === 'string' ? raw.shop : raw.shop?.id || raw.shop?._id || '',
  shopName: typeof raw.shop === 'object' ? raw.shop?.name : undefined,
  status: raw.status,
  pickupToken: raw.pickupToken || '',
  createdAt: raw.createdAt,
  completedAt: raw.completedAt,
  handledBy: typeof raw.handledBy === 'object' ? raw.handledBy?.name : raw.handledBy,
  notes: raw.notes,
  serviceType: raw.serviceType,
  serviceDetails: raw.serviceDetails,
  orderNumber: raw.orderNumber,
  paymentStatus: raw.paymentStatus,
  qrData: raw.qrData,
});

const mapOrders = (data: any): Order[] => {
  const arr = Array.isArray(data) ? data : [];
  return arr.map(mapOrder);
};

const orderService = {
  createOrder: async (data: { shopId: string; items: Array<{ foodItemId: string; quantity: number }>; notes?: string }): Promise<Order> => {
    const res = await api.post('/orders', data);
    return mapOrder(res.data.data);
  },
  getMyOrders: async (status?: string): Promise<Order[]> => {
    const params: any = {};
    if (status) params.status = status;
    const res = await api.get('/orders/my', { params });
    return mapOrders(res.data.data || res.data);
  },
  getMyActiveOrders: async (): Promise<Order[]> => {
    const res = await api.get('/orders/my', { params: { status: 'pending,preparing,ready', limit: 10 } });
    return mapOrders(res.data.data || res.data);
  },
  getShopOrders: async (status?: string): Promise<Order[]> => {
    const params: any = {};
    if (status) params.status = status;
    const res = await api.get('/orders/shop', { params });
    return mapOrders(res.data.data || res.data);
  },
  getActiveShopOrders: async (): Promise<Order[]> => {
    const res = await api.get('/orders/shop/active');
    return mapOrders(res.data.data || res.data);
  },
  getShopStats: async (): Promise<any> => {
    const res = await api.get('/orders/shop/stats');
    return res.data.data;
  },
  updateOrderStatus: async (orderId: string, status: OrderStatus, reason?: string): Promise<Order> => {
    const body: any = { status };
    if (reason) body.cancellationReason = reason;
    const res = await api.put(`/orders/${orderId}/status`, body);
    return mapOrder(res.data.data);
  },
  markItemDelivered: async (orderId: string, itemIndex: number): Promise<Order> => {
    const res = await api.patch(`/orders/${orderId}/items/${itemIndex}/deliver`);
    return mapOrder(res.data.data);
  },
  verifyQRCode: async (qrData: string): Promise<{ order: Order; valid: boolean }> => {
    const res = await api.post('/orders/verify-qr', { qrData });
    const d = res.data.data;
    return { order: mapOrder(d.order || d), valid: d.valid ?? true };
  },
  completeOrder: async (orderId: string): Promise<Order> => {
    const res = await api.post(`/orders/${orderId}/complete`);
    return mapOrder(res.data.data);
  },
  getOrderHistory: async (): Promise<{ completed: Order[]; cancelled: Order[] }> => {
    const [completed, cancelled] = await Promise.all([
      api.get('/orders/shop', { params: { status: 'completed' } }).then(r => mapOrders(r.data.data || r.data)),
      api.get('/orders/shop', { params: { status: 'cancelled' } }).then(r => mapOrders(r.data.data || r.data)),
    ]);
    return { completed, cancelled };
  },
  getOrderById: async (orderId: string): Promise<Order> => {
    const res = await api.get(`/orders/${orderId}`);
    return mapOrder(res.data.data);
  },
  createLaundryOrder: async (data: { shopId: string; serviceDetails: { type: 'laundry'; laundry: LaundryDetails }; notes?: string }): Promise<Order> => {
    const res = await api.post('/orders/laundry', data);
    return mapOrder(res.data.data);
  },
  createStationeryOrder: async (data: { shopId: string; serviceDetails: { type: 'stationery'; stationery: StationeryDetails }; notes?: string; fileUrl?: string }): Promise<Order> => {
    const res = await api.post('/orders/stationery', data);
    return mapOrder(res.data.data);
  },
};

export default orderService;
