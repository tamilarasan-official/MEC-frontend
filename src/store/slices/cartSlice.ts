import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { FoodItem } from '../../types';

export interface CartItemState {
  item: FoodItem;
  quantity: number;
  notes?: string;
}

interface CartState {
  items: CartItemState[];
  shopId: string | null;
  shopName: string | null;
}

const MAX_QUANTITY_PER_ITEM = 10;
const MAX_DISTINCT_ITEMS = 10;

const initialState: CartState = {
  items: [],
  shopId: null,
  shopName: null,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<{ item: FoodItem; shopId: string; shopName: string }>) => {
      const { item, shopId, shopName } = action.payload;
      // Switch shop → clear cart
      if (state.shopId && state.shopId !== shopId) {
        state.items = [];
      }
      state.shopId = shopId;
      state.shopName = shopName;
      const idx = state.items.findIndex(c => c.item.id === item.id);
      if (idx >= 0) {
        if (state.items[idx].quantity < MAX_QUANTITY_PER_ITEM) {
          state.items[idx].quantity += 1;
        }
      } else if (state.items.length < MAX_DISTINCT_ITEMS) {
        state.items.push({ item, quantity: 1 });
      }
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(c => c.item.id !== action.payload);
      if (state.items.length === 0) { state.shopId = null; state.shopName = null; }
    },
    updateQuantity: (state, action: PayloadAction<{ itemId: string; quantity: number }>) => {
      const { itemId, quantity } = action.payload;
      const idx = state.items.findIndex(c => c.item.id === itemId);
      if (idx >= 0) {
        if (quantity <= 0) {
          state.items.splice(idx, 1);
          if (state.items.length === 0) { state.shopId = null; state.shopName = null; }
        } else {
          state.items[idx].quantity = Math.min(quantity, MAX_QUANTITY_PER_ITEM);
        }
      }
    },
    incrementQuantity: (state, action: PayloadAction<string>) => {
      const idx = state.items.findIndex(c => c.item.id === action.payload);
      if (idx >= 0 && state.items[idx].quantity < MAX_QUANTITY_PER_ITEM) {
        state.items[idx].quantity += 1;
      }
    },
    decrementQuantity: (state, action: PayloadAction<string>) => {
      const idx = state.items.findIndex(c => c.item.id === action.payload);
      if (idx >= 0) {
        if (state.items[idx].quantity > 1) {
          state.items[idx].quantity -= 1;
        } else {
          state.items.splice(idx, 1);
          if (state.items.length === 0) { state.shopId = null; state.shopName = null; }
        }
      }
    },
    clearCart: () => initialState,
  },
});

// Selectors
export const selectCartItems = (state: { cart: CartState }) => state.cart.items;
export const selectCartShopId = (state: { cart: CartState }) => state.cart.shopId;
export const selectCartShopName = (state: { cart: CartState }) => state.cart.shopName;
export const selectCartItemCount = (state: { cart: CartState }) =>
  state.cart.items.reduce((t, c) => t + c.quantity, 0);
export const selectCartTotal = (state: { cart: CartState }) =>
  state.cart.items.reduce((t, c) => {
    const price = c.item.offerPrice ?? c.item.price;
    return t + price * c.quantity;
  }, 0);
export const selectItemQuantity = (itemId: string) => (state: { cart: CartState }) =>
  state.cart.items.find(c => c.item.id === itemId)?.quantity ?? 0;

export const {
  addToCart, removeFromCart, updateQuantity,
  incrementQuantity, decrementQuantity, clearCart,
} = cartSlice.actions;
export default cartSlice.reducer;
