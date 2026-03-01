import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Shop, FoodItem } from '../../types';
import api from '../../services/api';

// ---- Backend → Frontend mapper ----
// Backend returns _id, imageUrl, isVegetarian, category as object or string
function mapMenuItem(raw: any): FoodItem {
  const catRaw = raw.category;
  const categoryName = typeof catRaw === 'object' && catRaw !== null
    ? (catRaw.name || catRaw._id || '')
    : (catRaw || '');

  return {
    id: raw.id || raw._id || '',
    name: raw.name || '',
    description: raw.description || '',
    price: raw.price ?? 0,
    costPrice: raw.costPrice,
    image: raw.imageUrl || raw.image || '',
    category: categoryName,
    shopId: typeof raw.shop === 'string' ? raw.shop : raw.shop?.id || raw.shop?._id || raw.shopId || '',
    shopName: typeof raw.shop === 'object' ? raw.shop?.name : raw.shopName,
    isAvailable: raw.isAvailable ?? raw.available ?? true,
    isOffer: raw.isOfferActive ?? raw.isOffer ?? false,
    offerPrice: raw.offerPrice,
    rating: raw.rating,
    preparationTime: raw.preparationTime != null ? String(raw.preparationTime) : undefined,
    isVeg: raw.isVeg ?? raw.isVegetarian ?? false,
    isInstant: raw.isInstant ?? false,
  };
}

// ---- Frontend → Backend mapper for create/update ----
function toBackendPayload(data: Partial<FoodItem> & { categoryId?: string }): Record<string, any> {
  const payload: Record<string, any> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.description !== undefined) payload.description = data.description;
  if (data.price !== undefined) payload.price = data.price;
  if (data.costPrice !== undefined) payload.costPrice = data.costPrice;
  if (data.categoryId) {
    payload.categoryId = data.categoryId;
  } else if (data.category) {
    // No categoryId (custom category typed by owner) — send name so backend can find/create
    payload.categoryName = data.category;
  }
  if (data.image !== undefined) payload.imageUrl = data.image;
  if (data.isVeg !== undefined) payload.isVegetarian = data.isVeg;
  if (data.isInstant !== undefined) payload.isInstant = data.isInstant;
  if (data.isAvailable !== undefined) payload.isAvailable = data.isAvailable;
  if (data.preparationTime !== undefined) {
    // Send just the numeric value (strip " min" suffix)
    const num = parseInt(String(data.preparationTime).replace(/[^0-9]/g, ''), 10);
    payload.preparationTime = isNaN(num) ? data.preparationTime : num;
  }
  return payload;
}

// Unwrap items from various response formats
function unwrapItems(resData: any): any[] {
  const d = resData?.data || resData;
  if (Array.isArray(d)) return d;
  if (d?.items && Array.isArray(d.items)) return d.items;
  if (d?.menuItems && Array.isArray(d.menuItems)) return d.menuItems;
  return [];
}

interface MenuState {
  shops: Shop[];
  currentShop: Shop | null;
  menuItems: FoodItem[];
  offers: FoodItem[];
  ownerMenuItems: FoodItem[];
  ownerCategories: Array<{ id: string; name: string; isReadyServe?: boolean }>;
  categories: string[];
  selectedCategory: string | null;
  searchQuery: string;
  isLoading: boolean;
  ownerMenuLoading: boolean;
  ownerMenuLastFetched: number;
  error: string | null;
}

const initialState: MenuState = {
  shops: [],
  currentShop: null,
  menuItems: [],
  offers: [],
  ownerMenuItems: [],
  ownerCategories: [],
  categories: [],
  selectedCategory: null,
  searchQuery: '',
  isLoading: false,
  ownerMenuLoading: false,
  ownerMenuLastFetched: 0,
  error: null,
};

export const fetchShops = createAsyncThunk('menu/fetchShops', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/shops');
    const d = res.data.data || res.data;
    const shops = Array.isArray(d) ? d : d.shops || [];
    return shops as Shop[];
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const fetchShopMenu = createAsyncThunk(
  'menu/fetchShopMenu',
  async ({ shopId, category, search }: { shopId: string; category?: string; search?: string }, { rejectWithValue }) => {
    try {
      const params: any = {};
      if (category) params.categoryId = category;
      if (search) params.search = search;
      const res = await api.get(`/shops/${shopId}/menu`, { params });
      const items = unwrapItems(res.data);
      return items.map(mapMenuItem) as FoodItem[];
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

export const fetchShopCategories = createAsyncThunk(
  'menu/fetchShopCategories',
  async (shopId: string, { rejectWithValue }) => {
    try {
      const res = await api.get(`/shops/${shopId}/categories`);
      const raw = res.data.data || res.data;
      return (Array.isArray(raw) ? raw.map((c: any) => typeof c === 'string' ? c : c.name) : []) as string[];
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

// Fetch owner menu using the correct endpoint: GET /shops/{shopId}/menu
// Also fetches categories for the shop
export const fetchOwnerMenu = createAsyncThunk(
  'menu/fetchOwnerMenu',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: { user: { shopId?: string } | null } };
      const shopId = state.auth.user?.shopId;

      if (!shopId) {
        // Fallback: try the /owner/menu endpoint
        const res = await api.get('/owner/menu');
        const items = unwrapItems(res.data);
        return { items: items.map(mapMenuItem) as FoodItem[], categories: [] as Array<{ id: string; name: string; isReadyServe?: boolean }> };
      }

      // Fetch both menu items and categories in parallel
      const [menuRes, catRes] = await Promise.all([
        api.get(`/shops/${shopId}/menu`),
        api.get(`/shops/${shopId}/categories`).catch(() => ({ data: { data: [] } })),
      ]);

      const items = unwrapItems(menuRes.data);

      const catRaw = catRes.data?.data || catRes.data;
      const categories = Array.isArray(catRaw)
        ? catRaw.map((c: any) => ({
            id: c.id || c._id || '',
            name: typeof c === 'string' ? c : c.name || '',
            isReadyServe: c.isReadyServe,
          }))
        : [];

      return {
        items: items.map(mapMenuItem) as FoodItem[],
        categories,
      };
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to fetch menu');
    }
  },
);

export const createMenuItem = createAsyncThunk(
  'menu/createMenuItem',
  async (data: Partial<FoodItem>, { rejectWithValue }) => {
    try {
      const payload = toBackendPayload(data);
      const res = await api.post('/owner/menu', payload);
      const item = res.data?.data?.item || res.data?.data || res.data?.item || res.data;
      return mapMenuItem(item) as FoodItem;
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

export const updateMenuItem = createAsyncThunk(
  'menu/updateMenuItem',
  async ({ itemId, data }: { itemId: string; data: Partial<FoodItem> }, { rejectWithValue }) => {
    try {
      const payload = toBackendPayload(data);
      const res = await api.put(`/owner/menu/${itemId}`, payload);
      const item = res.data?.data?.item || res.data?.data || res.data?.item || res.data;
      return mapMenuItem(item) as FoodItem;
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

export const toggleItemAvailability = createAsyncThunk(
  'menu/toggleAvailability',
  async ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }, { rejectWithValue, dispatch }) => {
    dispatch(menuSlice.actions.optimisticToggle({ itemId, isAvailable }));
    try {
      const res = await api.patch(`/owner/menu/${itemId}/availability`, { isAvailable });
      const item = res.data?.data?.item || res.data?.data || res.data;
      return mapMenuItem(item) as FoodItem;
    } catch (e: any) {
      dispatch(menuSlice.actions.optimisticToggle({ itemId, isAvailable: !isAvailable }));
      return rejectWithValue(e.response?.data?.message || 'Failed');
    }
  },
);

export const setItemOffer = createAsyncThunk(
  'menu/setOffer',
  async ({ itemId, discountPercent, price, validUntil }: { itemId: string; discountPercent: number; price: number; validUntil?: string }, { rejectWithValue }) => {
    try {
      // Backend expects offerPrice (absolute) and offerEndDate, not discountPercent/validUntil
      const offerPrice = Math.round(price * (1 - discountPercent / 100));
      const offerEndDate = validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const res = await api.post(`/owner/menu/${itemId}/offer`, { offerPrice, offerEndDate });
      const item = res.data?.data?.item || res.data?.data || res.data;
      return mapMenuItem(item) as FoodItem;
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

export const removeItemOffer = createAsyncThunk(
  'menu/removeOffer',
  async (itemId: string, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/owner/menu/${itemId}/offer`);
      const item = res.data?.data?.item || res.data?.data || res.data;
      return mapMenuItem(item) as FoodItem;
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

export const deleteMenuItem = createAsyncThunk(
  'menu/deleteItem',
  async (itemId: string, { rejectWithValue }) => {
    try {
      await api.delete(`/owner/menu/${itemId}`);
      return itemId;
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    clearError: (s) => { s.error = null; },
    setSelectedCategory: (s, a: PayloadAction<string | null>) => { s.selectedCategory = a.payload; },
    setSearchQuery: (s, a: PayloadAction<string>) => { s.searchQuery = a.payload; },
    setCurrentShop: (s, a: PayloadAction<Shop | null>) => { s.currentShop = a.payload; },
    clearMenu: (s) => { s.menuItems = []; s.offers = []; s.currentShop = null; s.selectedCategory = null; s.searchQuery = ''; },
    optimisticToggle: (s, a: PayloadAction<{ itemId: string; isAvailable: boolean }>) => {
      const i = s.ownerMenuItems.findIndex(x => x.id === a.payload.itemId);
      if (i >= 0) s.ownerMenuItems[i] = { ...s.ownerMenuItems[i], isAvailable: a.payload.isAvailable };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchShops.fulfilled, (s, a) => { s.isLoading = false; s.shops = a.payload; })
      .addCase(fetchShops.pending, (s) => { s.isLoading = true; })
      .addCase(fetchShops.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; });
    builder
      .addCase(fetchShopMenu.fulfilled, (s, a) => { s.isLoading = false; s.menuItems = a.payload; })
      .addCase(fetchShopMenu.pending, (s) => { s.isLoading = true; })
      .addCase(fetchShopMenu.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; });
    builder
      .addCase(fetchShopCategories.fulfilled, (s, a) => { s.categories = a.payload; });
    builder
      .addCase(fetchOwnerMenu.fulfilled, (s, a) => {
        s.ownerMenuLoading = false;
        s.ownerMenuItems = a.payload.items;
        s.ownerCategories = a.payload.categories;
        s.ownerMenuLastFetched = Date.now();
      })
      .addCase(fetchOwnerMenu.pending, (s) => { s.ownerMenuLoading = s.ownerMenuItems.length === 0; })
      .addCase(fetchOwnerMenu.rejected, (s) => { s.ownerMenuLoading = false; });
    builder
      .addCase(createMenuItem.fulfilled, (s, a) => { s.ownerMenuItems.push(a.payload); });
    builder
      .addCase(updateMenuItem.fulfilled, (s, a) => {
        const i = s.ownerMenuItems.findIndex(x => x.id === a.payload.id);
        if (i >= 0) s.ownerMenuItems[i] = a.payload;
      });
    builder
      .addCase(toggleItemAvailability.fulfilled, (s, a) => {
        const i = s.ownerMenuItems.findIndex(x => x.id === a.payload.id);
        if (i >= 0) s.ownerMenuItems[i] = a.payload;
      });
    builder
      .addCase(setItemOffer.fulfilled, (s, a) => {
        const i = s.ownerMenuItems.findIndex(x => x.id === a.payload.id);
        if (i >= 0) s.ownerMenuItems[i] = a.payload;
      });
    builder
      .addCase(removeItemOffer.fulfilled, (s, a) => {
        const i = s.ownerMenuItems.findIndex(x => x.id === a.payload.id);
        if (i >= 0) s.ownerMenuItems[i] = a.payload;
      });
    builder
      .addCase(deleteMenuItem.fulfilled, (s, a) => {
        s.ownerMenuItems = s.ownerMenuItems.filter(x => x.id !== a.payload);
      });
  },
});

export const { clearError, setSelectedCategory, setSearchQuery, setCurrentShop, clearMenu, optimisticToggle } = menuSlice.actions;
export default menuSlice.reducer;
