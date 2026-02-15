import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Order, OrderStatus, CartItem } from '../../types';
import api from '../../services/api';

// ---- API → Frontend mappers (same as orderService) ----
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

interface OrdersState {
  orders: Order[];
  activeOrders: Order[];
  shopOrders: Order[];
  currentOrder: Order | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: OrdersState = {
  orders: [],
  activeOrders: [],
  shopOrders: [],
  currentOrder: null,
  isLoading: false,
  error: null,
};

// Student thunks
export const createOrder = createAsyncThunk(
  'orders/createOrder',
  async (data: { shopId: string; items: Array<{ foodItemId: string; quantity: number }>; notes?: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/orders', data);
      return mapOrder(res.data.data);
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to create order');
    }
  },
);

export const fetchMyOrders = createAsyncThunk(
  'orders/fetchMyOrders',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/orders/my');
      return mapOrders(res.data.data || res.data);
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to fetch orders');
    }
  },
);

export const fetchMyActiveOrders = createAsyncThunk(
  'orders/fetchMyActiveOrders',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/orders/my', { params: { status: 'pending,preparing,ready', limit: 10 } });
      return mapOrders(res.data.data || res.data);
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to fetch active orders');
    }
  },
);

// Captain/Owner thunks
export const fetchShopOrders = createAsyncThunk(
  'orders/fetchShopOrders',
  async (params: { status?: string } = {}, { rejectWithValue }) => {
    try {
      const res = await api.get('/orders/shop', { params });
      return mapOrders(res.data.data || res.data);
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to fetch shop orders');
    }
  },
);

export const fetchActiveShopOrders = createAsyncThunk(
  'orders/fetchActiveShopOrders',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/orders/shop/active');
      return mapOrders(res.data.data || res.data);
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to fetch active shop orders');
    }
  },
);

export const updateOrderStatus = createAsyncThunk(
  'orders/updateOrderStatus',
  async ({ orderId, status, reason }: { orderId: string; status: OrderStatus; reason?: string }, { rejectWithValue }) => {
    try {
      const body: any = { status };
      if (reason) body.cancellationReason = reason;
      const res = await api.put(`/orders/${orderId}/status`, body);
      return mapOrder(res.data.data);
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to update order');
    }
  },
);

export const markItemDelivered = createAsyncThunk(
  'orders/markItemDelivered',
  async ({ orderId, itemIndex }: { orderId: string; itemIndex: number }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/orders/${orderId}/items/${itemIndex}/deliver`);
      return mapOrder(res.data.data);
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to mark item');
    }
  },
);

export const verifyQRCode = createAsyncThunk(
  'orders/verifyQRCode',
  async (qrData: string, { rejectWithValue }) => {
    try {
      const res = await api.post('/orders/verify-qr', { qrData });
      const d = res.data.data;
      return { order: mapOrder(d.order || d), valid: d.valid ?? true };
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'QR verification failed');
    }
  },
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setCurrentOrder: (state, action: PayloadAction<Order | null>) => {
      state.currentOrder = action.payload;
    },
    updateOrderInList: (state, action: PayloadAction<Order>) => {
      const o = action.payload;
      const ui = state.orders.findIndex(x => x.id === o.id);
      if (ui >= 0) state.orders[ui] = o;
      const ai = state.activeOrders.findIndex(x => x.id === o.id);
      if (ai >= 0) state.activeOrders[ai] = o;
      const si = state.shopOrders.findIndex(x => x.id === o.id);
      if (si >= 0) state.shopOrders[si] = o;
      if (state.currentOrder?.id === o.id) state.currentOrder = o;
    },
    addNewOrder: (state, action: PayloadAction<Order>) => {
      state.shopOrders.unshift(action.payload);
    },
    resetOrders: () => initialState,
  },
  extraReducers: (builder) => {
    // Create Order
    builder
      .addCase(createOrder.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(createOrder.fulfilled, (s, a) => { s.isLoading = false; s.currentOrder = a.payload; s.orders.unshift(a.payload); })
      .addCase(createOrder.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; });
    // Fetch my orders
    builder
      .addCase(fetchMyOrders.pending, (s) => { s.isLoading = true; })
      .addCase(fetchMyOrders.fulfilled, (s, a) => { s.isLoading = false; s.orders = a.payload; })
      .addCase(fetchMyOrders.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; });
    // Fetch active orders
    builder
      .addCase(fetchMyActiveOrders.fulfilled, (s, a) => { s.activeOrders = a.payload; });
    // Fetch shop orders
    builder
      .addCase(fetchShopOrders.pending, (s) => { s.isLoading = true; })
      .addCase(fetchShopOrders.fulfilled, (s, a) => { s.isLoading = false; s.shopOrders = a.payload; })
      .addCase(fetchShopOrders.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; });
    // Active shop orders
    builder
      .addCase(fetchActiveShopOrders.fulfilled, (s, a) => { s.shopOrders = a.payload; });
    // Update status
    builder
      .addCase(updateOrderStatus.fulfilled, (s, a) => {
        const idx = s.shopOrders.findIndex(o => o.id === a.payload.id);
        if (idx >= 0) s.shopOrders[idx] = a.payload;
      });
    // Mark item delivered
    builder
      .addCase(markItemDelivered.fulfilled, (s, a) => {
        const idx = s.shopOrders.findIndex(o => o.id === a.payload.id);
        if (idx >= 0) s.shopOrders[idx] = a.payload;
      });
    // Verify QR
    builder
      .addCase(verifyQRCode.fulfilled, (s, a) => { if (a.payload.order) s.currentOrder = a.payload.order; });
  },
});

export const { clearError, setCurrentOrder, updateOrderInList, addNewOrder, resetOrders } = ordersSlice.actions;
export default ordersSlice.reducer;
