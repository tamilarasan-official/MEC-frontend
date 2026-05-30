import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Order, OrderStatus, CartItem, CreateOrderResult } from '../../types';
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
  itemStatus: item.itemStatus || 'preparing',
  rejectedAt: item.rejectedAt,
  refundAmount: item.refundAmount,
});

const mapOrder = (raw: any): Order => ({
  id: raw.id || raw._id,
  userId: typeof raw.user === 'string' ? raw.user : raw.user?.id || raw.user?._id || '',
  userName: raw.userName || (typeof raw.user === 'object' ? raw.user?.name : '') || '',
  items: Array.isArray(raw.items) ? raw.items.map(mapOrderItem) : [],
  total: raw.total ?? 0,
  shopId: typeof raw.shop === 'string' ? raw.shop : raw.shop?.id || raw.shop?._id || '',
  shopName: typeof raw.shop === 'object' ? raw.shop?.name : undefined,
  status: raw.status,
  pickupToken: raw.pickupToken || '',
  createdAt: raw.createdAt,
  completedAt: raw.completedAt,
  handledBy: typeof raw.handledBy === 'object' ? raw.handledBy?.name : raw.handledBy,
  notes: raw.special_instructions || raw.notes,
  serviceType: raw.serviceType,
  serviceDetails: raw.serviceDetails,
  orderNumber: raw.orderNumber,
  paymentStatus: raw.paymentStatus,
  qrData: raw.qrCode || raw.qrData,
  isReadyServe: raw.isReadyServe ?? false,
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
    // Step 1: Make the API call — if this fails, the order was NOT created
    let res: any;
    try {
      const payload = {
        shopId: data.shopId,
        items: data.items.map(i => ({ foodItemId: i.foodItemId, quantity: i.quantity })),
        ...(data.notes ? { special_instructions: data.notes } : {}),
      };
      res = await api.post('/orders', payload);
    } catch (e: any) {
      const status = e.response?.status;
      if (__DEV__) console.error('[createOrder] FAILED:', e.response?.data, 'status:', status);
      let msg = 'Failed to place order. Please try again.';
      if (!e.response) {
        msg = 'Network error. Please check your connection.';
      } else if (status === 400) {
        msg = 'Invalid order. Please check your cart and try again.';
      } else if (status === 402) {
        msg = 'Insufficient wallet balance. Please top up and try again.';
      } else if (status === 404) {
        msg = 'Shop or item not found. Please refresh and try again.';
      } else if (status === 409) {
        msg = 'Shop is currently closed or item is unavailable.';
      } else if (status === 429) {
        msg = 'Too many requests. Please try again later.';
      } else if (status >= 500) {
        msg = 'Server error. Please try again later.';
      }
      return rejectWithValue(msg);
    }

    // Step 2: Map the response — if this fails, the order WAS created so
    // we must still return success to avoid showing "Order Failed" falsely
    try {
      const d = res.data.data;

      // Handle split orders (mixed instant + regular items)
      if (d?.wasSplit && Array.isArray(d?.orders)) {
        const mappedOrders = d.orders.map(mapOrder);
        return {
          order: mappedOrders[0],
          orders: mappedOrders,
          wasSplit: true,
          newBalance: d.newBalance,
        } as CreateOrderResult;
      }

      // Single order (all instant or all regular)
      const mappedOrder = mapOrder(d?.order || d);
      return {
        order: mappedOrder,
        wasSplit: false,
        newBalance: d?.newBalance,
      } as CreateOrderResult;
    } catch {
      // Mapping failed but order exists — return a minimal success result
      const d = res.data?.data;
      const fallbackOrder = mapOrder(d?.order || d || {});
      return {
        order: fallbackOrder,
        wasSplit: false,
        newBalance: d?.newBalance,
      } as CreateOrderResult;
    }
  },
);

export const fetchMyOrders = createAsyncThunk(
  'orders/fetchMyOrders',
  async (params: { serviceType?: string } | undefined, { rejectWithValue }) => {
    try {
      const qp: any = { limit: 100 };
      if (params?.serviceType) qp.serviceType = params.serviceType;
      const res = await api.get('/orders/my', { params: qp });
      return mapOrders(res.data.data || res.data);
    } catch (e: any) {
      if (__DEV__) console.error('[fetchMyOrders]', e.response?.status, e.response?.data);
      return rejectWithValue('Failed to load orders. Please try again.');
    }
  },
);

export const fetchMyActiveOrders = createAsyncThunk(
  'orders/fetchMyActiveOrders',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/orders/my', { params: { status: 'pending,preparing,partially_ready,ready,partially_delivered', limit: 50 } });
      return mapOrders(res.data.data || res.data);
    } catch (e: any) {
      if (__DEV__) console.error('[fetchMyActiveOrders]', e.response?.status, e.response?.data);
      return rejectWithValue('Failed to load active orders. Please try again.');
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
      if (__DEV__) console.error('[fetchShopOrders]', e.response?.status, e.response?.data);
      return rejectWithValue('Failed to load shop orders. Please try again.');
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
      if (__DEV__) console.error('[fetchActiveShopOrders]', e.response?.status, e.response?.data);
      return rejectWithValue('Failed to load active shop orders. Please try again.');
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
      const status = e.response?.status;
      if (__DEV__) console.error('[updateOrderStatus]', e.response?.data, 'status:', status);
      let msg = 'Failed to update order. Please try again.';
      if (!e.response) {
        msg = 'Network error. Please check your connection.';
      } else if (status === 404) {
        msg = 'Order not found.';
      } else if (status === 409) {
        msg = 'Order cannot be changed at this stage.';
      } else if (status >= 500) {
        msg = 'Server error. Please try again later.';
      }
      return rejectWithValue(msg);
    }
  },
);

export const completeOrder = createAsyncThunk(
  'orders/completeOrder',
  async ({ orderId }: { orderId: string }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/orders/${orderId}/complete`);
      return mapOrder(res.data.data);
    } catch (e: any) {
      const status = e.response?.status;
      if (__DEV__) console.error('[completeOrder]', e.response?.data, 'status:', status);
      let msg = 'Failed to complete order. Please try again.';
      if (!e.response) {
        msg = 'Network error. Please check your connection.';
      } else if (status === 400 || status === 409) {
        msg = 'Order cannot be completed yet.';
      } else if (status === 404) {
        msg = 'Order not found.';
      } else if (status >= 500) {
        msg = 'Server error. Please try again later.';
      }
      return rejectWithValue(msg);
    }
  },
);

export const markItemDelivered = createAsyncThunk(
  'orders/markItemDelivered',
  async ({ orderId, itemIndex, delivered = true, itemStatus }: { orderId: string; itemIndex: number; delivered?: boolean; itemStatus?: 'preparing' | 'ready' | 'delivered' }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/orders/${orderId}/items/${itemIndex}/deliver`, { delivered, itemStatus });
      return mapOrder(res.data.data);
    } catch (e: any) {
      if (__DEV__) console.error('[markItemDelivered]', e.response?.status, e.response?.data);
      return rejectWithValue('Failed to update item. Please try again.');
    }
  },
);

export const acceptItem = createAsyncThunk(
  'orders/acceptItem',
  async ({ orderId, itemIndex }: { orderId: string; itemIndex: number }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/orders/${orderId}/items/${itemIndex}/accept`);
      return mapOrder(res.data.data);
    } catch (e: any) {
      if (__DEV__) console.error('[acceptItem]', e.response?.status, e.response?.data);
      return rejectWithValue('Failed to accept item. Please try again.');
    }
  },
);

export const rejectItem = createAsyncThunk(
  'orders/rejectItem',
  async ({ orderId, itemIndex, reason }: { orderId: string; itemIndex: number; reason?: string }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/orders/${orderId}/items/${itemIndex}/reject`, { reason });
      return mapOrder(res.data.data);
    } catch (e: any) {
      if (__DEV__) console.error('[rejectItem]', e.response?.status, e.response?.data);
      return rejectWithValue('Failed to reject item. Please try again.');
    }
  },
);

export const acceptAllItems = createAsyncThunk(
  'orders/acceptAllItems',
  async ({ orderId }: { orderId: string }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/orders/${orderId}/accept-all`);
      return mapOrder(res.data.data);
    } catch (e: any) {
      if (__DEV__) console.error('[acceptAllItems]', e.response?.status, e.response?.data);
      return rejectWithValue('Failed to accept items. Please try again.');
    }
  },
);

export const rejectAllItems = createAsyncThunk(
  'orders/rejectAllItems',
  async ({ orderId, reason }: { orderId: string; reason?: string }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/orders/${orderId}/reject-all`, { reason });
      return mapOrder(res.data.data);
    } catch (e: any) {
      if (__DEV__) console.error('[rejectAllItems]', e.response?.status, e.response?.data);
      return rejectWithValue('Failed to reject order. Please try again.');
    }
  },
);

export const verifyQRCode = createAsyncThunk(
  'orders/verifyQRCode',
  async (qrData: string, { rejectWithValue }) => {
    try {
      const res = await api.post('/orders/verify-qr', { qrCode: qrData });
      const d = res.data.data;
      return { order: mapOrder(d.order || d), valid: d.valid ?? true };
    } catch (e: any) {
      if (__DEV__) console.error('[verifyQRCode]', e.response?.status, e.response?.data);
      return rejectWithValue('QR verification failed. Please try again.');
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
    // Patch order status + item statuses in-place — used by socket handler so QR modal
    // reflects real-time updates even for terminal statuses (completed/cancelled)
    // that get dropped from activeOrders on the next refetch.
    patchOrderStatus: (state, action: PayloadAction<{
      orderId: string;
      status: Order['status'];
      items?: { name: string; quantity: number; itemStatus?: string; delivered?: boolean }[];
    }>) => {
      const { orderId, status, items } = action.payload;
      const patchOrder = (order: Order) => {
        order.status = status;
        // Patch per-item statuses if provided by socket payload
        if (items && items.length > 0 && order.items.length === items.length) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].itemStatus) {
              order.items[i] = { ...order.items[i], itemStatus: items[i].itemStatus as any };
            }
            if (items[i].delivered !== undefined) {
              order.items[i] = { ...order.items[i], delivered: items[i].delivered };
            }
          }
        }
      };
      for (const list of [state.orders, state.activeOrders, state.shopOrders]) {
        const idx = list.findIndex(o => o.id === orderId);
        if (idx >= 0) patchOrder(list[idx]);
      }
      if (state.currentOrder?.id === orderId) {
        patchOrder(state.currentOrder);
      }
    },
    resetOrders: () => initialState,
  },
  extraReducers: (builder) => {
    // Create Order
    builder
      .addCase(createOrder.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(createOrder.fulfilled, (s, a) => {
        s.isLoading = false;
        const result = a.payload;
        s.currentOrder = result.order;
        if (result.wasSplit && result.orders) {
          // Add all split orders to the list
          for (const o of result.orders) {
            s.orders.unshift(o);
          }
        } else {
          s.orders.unshift(result.order);
        }
      })
      .addCase(createOrder.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; });
    // Fetch my orders
    builder
      .addCase(fetchMyOrders.pending, (s) => { s.isLoading = true; })
      .addCase(fetchMyOrders.fulfilled, (s, a) => { s.isLoading = false; s.orders = a.payload; })
      .addCase(fetchMyOrders.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; });
    // Fetch active orders
    builder
      .addCase(fetchMyActiveOrders.pending, (s) => { s.error = null; })
      .addCase(fetchMyActiveOrders.fulfilled, (s, a) => { s.activeOrders = a.payload; })
      .addCase(fetchMyActiveOrders.rejected, (s, a) => { s.error = a.payload as string; });
    // Fetch shop orders
    builder
      .addCase(fetchShopOrders.pending, (s) => { s.isLoading = true; })
      .addCase(fetchShopOrders.fulfilled, (s, a) => { s.isLoading = false; s.shopOrders = a.payload; })
      .addCase(fetchShopOrders.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; });
    // Active shop orders
    builder
      .addCase(fetchActiveShopOrders.pending, (s) => { s.error = null; })
      .addCase(fetchActiveShopOrders.fulfilled, (s, a) => { s.shopOrders = a.payload; })
      .addCase(fetchActiveShopOrders.rejected, (s, a) => { s.error = a.payload as string; });
    // Update status
    builder
      .addCase(updateOrderStatus.pending, (s) => { s.error = null; })
      .addCase(updateOrderStatus.fulfilled, (s, a) => {
        const o = a.payload;
        const si = s.shopOrders.findIndex(x => x.id === o.id);
        if (si >= 0) s.shopOrders[si] = o;
        const ai = s.activeOrders.findIndex(x => x.id === o.id);
        if (ai >= 0) s.activeOrders[ai] = o;
        const ui = s.orders.findIndex(x => x.id === o.id);
        if (ui >= 0) s.orders[ui] = o;
        if (s.currentOrder?.id === o.id) s.currentOrder = o;
      })
      .addCase(updateOrderStatus.rejected, (s, a) => { s.error = a.payload as string; });
    builder
      .addCase(completeOrder.pending, (s) => { s.error = null; })
      .addCase(completeOrder.fulfilled, (s, a) => {
        const o = a.payload;
        const si = s.shopOrders.findIndex(x => x.id === o.id);
        if (si >= 0) s.shopOrders[si] = o;
        const ai = s.activeOrders.findIndex(x => x.id === o.id);
        if (ai >= 0) s.activeOrders[ai] = o;
        const ui = s.orders.findIndex(x => x.id === o.id);
        if (ui >= 0) s.orders[ui] = o;
        if (s.currentOrder?.id === o.id) s.currentOrder = o;
      })
      .addCase(completeOrder.rejected, (s, a) => { s.error = a.payload as string; });
    // Mark item delivered
    builder
      .addCase(markItemDelivered.pending, (s) => { s.error = null; })
      .addCase(markItemDelivered.fulfilled, (s, a) => {
        const o = a.payload;
        const si = s.shopOrders.findIndex(x => x.id === o.id);
        if (si >= 0) s.shopOrders[si] = o;
        const ai = s.activeOrders.findIndex(x => x.id === o.id);
        if (ai >= 0) s.activeOrders[ai] = o;
        const ui = s.orders.findIndex(x => x.id === o.id);
        if (ui >= 0) s.orders[ui] = o;
        if (s.currentOrder?.id === o.id) s.currentOrder = o;
      })
      .addCase(markItemDelivered.rejected, (s, a) => { s.error = a.payload as string; });
    // Accept/Reject item — same reducer pattern: replace order in all lists
    const replaceOrder = (s: OrdersState, o: Order) => {
      for (const list of [s.shopOrders, s.activeOrders, s.orders]) {
        const idx = list.findIndex(x => x.id === o.id);
        if (idx >= 0) list[idx] = o;
      }
      if (s.currentOrder?.id === o.id) s.currentOrder = o;
    };
    builder
      .addCase(acceptItem.fulfilled, (s, a) => { replaceOrder(s, a.payload); })
      .addCase(acceptItem.rejected, (s, a) => { s.error = a.payload as string; })
      .addCase(rejectItem.fulfilled, (s, a) => { replaceOrder(s, a.payload); })
      .addCase(rejectItem.rejected, (s, a) => { s.error = a.payload as string; })
      .addCase(acceptAllItems.fulfilled, (s, a) => { replaceOrder(s, a.payload); })
      .addCase(acceptAllItems.rejected, (s, a) => { s.error = a.payload as string; })
      .addCase(rejectAllItems.fulfilled, (s, a) => { replaceOrder(s, a.payload); })
      .addCase(rejectAllItems.rejected, (s, a) => { s.error = a.payload as string; });
    // Verify QR
    builder
      .addCase(verifyQRCode.pending, (s) => { s.error = null; })
      .addCase(verifyQRCode.fulfilled, (s, a) => { if (a.payload.order) s.currentOrder = a.payload.order; })
      .addCase(verifyQRCode.rejected, (s, a) => { s.error = a.payload as string; });
  },
});

export const { clearError, setCurrentOrder, updateOrderInList, addNewOrder, patchOrderStatus, resetOrders } = ordersSlice.actions;
export default ordersSlice.reducer;
