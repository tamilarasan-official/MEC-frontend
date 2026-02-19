import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Shop, FoodItem } from '../../types';
import api from '../../services/api';

interface MenuState {
  shops: Shop[];
  currentShop: Shop | null;
  menuItems: FoodItem[];
  offers: FoodItem[];
  ownerMenuItems: FoodItem[];
  categories: string[];
  selectedCategory: string | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
}

const initialState: MenuState = {
  shops: [],
  currentShop: null,
  menuItems: [],
  offers: [],
  ownerMenuItems: [],
  categories: [],
  selectedCategory: null,
  searchQuery: '',
  isLoading: false,
  error: null,
};

export const fetchShops = createAsyncThunk('menu/fetchShops', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/shops');
    const d = res.data.data || res.data;
    // API wraps shops in { shops: [...] } — unwrap to get the array
    const shops = Array.isArray(d) ? d : d.shops || [];
    return shops as Shop[];
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const fetchShopMenu = createAsyncThunk(
  'menu/fetchShopMenu',
  async ({ shopId, category, search }: { shopId: string; category?: string; search?: string }, { rejectWithValue }) => {
    try {
      const params: any = {};
      if (category) params.category = category;
      if (search) params.search = search;
      const res = await api.get(`/shops/${shopId}/menu`, { params });
      return (res.data.data || res.data) as FoodItem[];
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

export const fetchShopCategories = createAsyncThunk(
  'menu/fetchShopCategories',
  async (shopId: string, { rejectWithValue }) => {
    try {
      const res = await api.get(`/shops/${shopId}/categories`);
      const raw = res.data.data || res.data;
      // API may return category objects — extract name strings
      return (Array.isArray(raw) ? raw.map((c: any) => typeof c === 'string' ? c : c.name) : []) as string[];
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

export const fetchOwnerMenu = createAsyncThunk('menu/fetchOwnerMenu', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/owner/menu');
    return (res.data.data || res.data) as FoodItem[];
  } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const createMenuItem = createAsyncThunk(
  'menu/createMenuItem',
  async (data: Partial<FoodItem>, { rejectWithValue }) => {
    try {
      const res = await api.post('/owner/menu', data);
      return res.data.data as FoodItem;
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

export const updateMenuItem = createAsyncThunk(
  'menu/updateMenuItem',
  async ({ itemId, data }: { itemId: string; data: Partial<FoodItem> }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/owner/menu/${itemId}`, data);
      return res.data.data as FoodItem;
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

export const toggleItemAvailability = createAsyncThunk(
  'menu/toggleAvailability',
  async ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/owner/menu/${itemId}/availability`, { isAvailable });
      return res.data.data as FoodItem;
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

export const setItemOffer = createAsyncThunk(
  'menu/setOffer',
  async ({ itemId, offerPrice }: { itemId: string; offerPrice: number }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/owner/menu/${itemId}/offer`, { offerPrice });
      return res.data.data as FoodItem;
    } catch (e: any) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
  },
);

export const removeItemOffer = createAsyncThunk(
  'menu/removeOffer',
  async (itemId: string, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/owner/menu/${itemId}/offer`);
      return res.data.data as FoodItem;
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
      .addCase(fetchOwnerMenu.fulfilled, (s, a) => { s.isLoading = false; s.ownerMenuItems = a.payload; })
      .addCase(fetchOwnerMenu.pending, (s) => { s.isLoading = true; });
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

export const { clearError, setSelectedCategory, setSearchQuery, setCurrentShop, clearMenu } = menuSlice.actions;
export default menuSlice.reducer;
