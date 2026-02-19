import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, FlatList,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { addToCart, updateQuantity } from '../../store/slices/cartSlice';
import menuService from '../../services/menuService';
import { FoodItem } from '../../types';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SearchModal({ visible, onClose }: SearchModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { shops } = useAppSelector(s => s.menu);
  const { items: cartItems } = useAppSelector(s => s.cart);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(FoodItem & { shopLabel?: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const activeShops = shops.filter(s => s.isActive);
      const allResults = await Promise.all(
        activeShops.map(async (shop) => {
          try {
            const items = await menuService.getShopMenu(shop.id, undefined, q);
            return items.map(item => ({ ...item, shopLabel: shop.name, shopId: item.shopId || shop.id }));
          } catch { return []; }
        }),
      );
      setResults(allResults.flat());
    } catch { setResults([]); }
    setLoading(false);
  }, [shops]);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 400);
  };

  const getCartQty = (id: string) => cartItems.find(c => c.item.id === id)?.quantity || 0;

  const getShopForItem = (item: FoodItem) => {
    return shops.find(s => s.id === item.shopId);
  };

  const groupedResults = results.reduce<Record<string, (FoodItem & { shopLabel?: string })[]>>((acc, item) => {
    const label = item.shopLabel || 'Items';
    if (!acc[label]) acc[label] = [];
    acc[label].push(item);
    return acc;
  }, {});

  const sections = Object.entries(groupedResults).map(([label, items]) => ({ label, items }));

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Icon name="search" size={18} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search food, stationery..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={handleChangeText}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Icon name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Results */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : results.length === 0 && query.length >= 2 ? (
            <View style={styles.center}>
              <Icon name="search" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No items found for "{query}"</Text>
            </View>
          ) : (
            <FlatList
              data={sections}
              keyExtractor={(s) => s.label}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item: section }) => (
                <View>
                  <Text style={styles.sectionLabel}>{section.label.toUpperCase()}</Text>
                  {section.items.map(item => {
                    const qty = getCartQty(item.id);
                    const shop = getShopForItem(item);
                    const displayPrice = item.isOffer && item.offerPrice ? item.offerPrice : item.price;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.resultItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (qty === 0 && shop) {
                            dispatch(addToCart({ item, shopId: shop.id, shopName: shop.name }));
                          } else {
                            dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 }));
                          }
                        }}>
                        {item.image ? (
                          <Image source={{ uri: item.image }} style={styles.itemImage} />
                        ) : (
                          <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                            <Icon name="restaurant-outline" size={18} color={colors.textMuted} />
                          </View>
                        )}
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.itemDesc} numberOfLines={1}>
                            {item.description || `Delicious ${item.name} from ${item.shopLabel || 'Shop'}`}
                          </Text>
                        </View>
                        <Text style={styles.itemPrice}>Rs. {displayPrice}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-start',
  },
  container: {
    flex: 1, backgroundColor: colors.background, marginTop: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0,
  },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  emptyText: { fontSize: 14, color: colors.textMuted },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 1, marginTop: 16, marginBottom: 8,
  },
  resultItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemImage: { width: 44, height: 44, borderRadius: 10 },
  itemImagePlaceholder: {
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: colors.text },
});
