import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, FlatList,
  TouchableOpacity, Image, ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { shops } = useAppSelector(s => s.menu);
  const { items: cartItems } = useAppSelector(s => s.cart);
  const [query, setQuery] = useState('');
  const [allItems, setAllItems] = useState<(FoodItem & { shopLabel: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const itemsLoaded = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useMemo(() => new Animated.Value(-800), []);

  // Pre-load all menu items when modal opens (same approach as web app)
  const loadAllItems = useCallback(async () => {
    if (itemsLoaded.current) return;
    setLoading(true);
    try {
      const activeShops = shops.filter(s => s.isActive);
      const allResults = await Promise.all(
        activeShops.map(async (shop) => {
          try {
            const items = await menuService.getShopMenu(shop.id);
            return items.map(item => ({
              ...item,
              shopLabel: shop.name,
              shopId: item.shopId || shop.id,
            }));
          } catch { return []; }
        }),
      );
      setAllItems(allResults.flat());
      itemsLoaded.current = true;
    } catch { /* ignore */ }
    setLoading(false);
  }, [shops]);

  // Slide down from top when modal opens
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(-800);
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }).start();
      setTimeout(() => inputRef.current?.focus(), 300);
      loadAllItems();
    } else {
      setQuery('');
    }
  }, [visible, slideAnim, loadAllItems]);

  // Filter items locally (like the web app)
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allItems.filter(
      item => item.isAvailable &&
        (item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)),
    );
  }, [query, allItems]);

  // Group filtered items by shop label
  const sections = useMemo(() => {
    const groups: Record<string, (FoodItem & { shopLabel: string })[]> = {};
    for (const item of filteredItems) {
      const label = item.shopLabel || 'Items';
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    }
    return Object.entries(groups).map(([label, items]) => ({ label, items: items.slice(0, 10) }));
  }, [filteredItems]);

  const getCartQty = (id: string) => cartItems.find(c => c.item.id === id)?.quantity || 0;

  const getShopForItem = (item: FoodItem) => shops.find(s => s.id === item.shopId);

  const handleAdd = (item: FoodItem & { shopLabel: string }) => {
    const qty = getCartQty(item.id);
    const shop = getShopForItem(item);
    if (qty === 0 && shop) {
      dispatch(addToCart({ item, shopId: shop.id, shopName: shop.name }));
    } else {
      dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 }));
    }
  };

  const IMAGE_BASE = 'https://backend.mec.welocalhost.com';
  const resolveImage = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${IMAGE_BASE}${url}`;
  };

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
        <Animated.View style={[styles.container, { paddingTop: insets.top + 8, transform: [{ translateY: slideAnim }] }]}>
          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Icon name="search" size={18} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search food, stationery..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
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
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : query.trim().length === 0 ? (
            <View style={styles.center}>
              <View style={{ opacity: 0.4 }}>
                <Icon name="search" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyText}>Type to search across all shops</Text>
            </View>
          ) : filteredItems.length === 0 ? (
            <View style={styles.center}>
              <View style={{ opacity: 0.4 }}>
                <Icon name="search" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyText}>No items found for &quot;{query}&quot;</Text>
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
                    const displayPrice = item.isOffer && item.offerPrice ? item.offerPrice : item.price;
                    const imageUri = resolveImage(item.image);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.resultItem}
                        activeOpacity={0.7}
                        onPress={() => handleAdd(item)}>
                        {imageUri ? (
                          <Image source={{ uri: imageUri }} style={styles.itemImage} />
                        ) : (
                          <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                            <Icon name="restaurant-outline" size={18} color={colors.textMuted} />
                          </View>
                        )}
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.itemPrice}>Rs. {displayPrice}</Text>
                        </View>
                        {qty === 0 ? (
                          <View style={styles.addBtn}>
                            <Icon name="add" size={16} color="#fff" />
                          </View>
                        ) : (
                          <View style={styles.qtyRow}>
                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={(e) => { e.stopPropagation(); dispatch(updateQuantity({ itemId: item.id, quantity: qty - 1 })); }}>
                              <Icon name="remove" size={14} color={colors.accent} />
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>{qty}</Text>
                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={(e) => { e.stopPropagation(); dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 })); }}>
                              <Icon name="add" size={14} color={colors.accent} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />
          )}
        </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-start',
  },
  container: {
    backgroundColor: colors.background, borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    maxHeight: '85%', minHeight: Dimensions.get('window').height * 0.4,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0,
  },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 48,
  },
  emptyText: { fontSize: 14, color: colors.textMuted },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 1, marginTop: 16, marginBottom: 8,
  },
  resultItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemImage: { width: 40, height: 40, borderRadius: 10 },
  itemImagePlaceholder: {
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemPrice: { fontSize: 13, fontWeight: '600', color: colors.accent, marginTop: 2 },
  addBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.accentBg, borderRadius: 8,
  },
  qtyBtn: {
    padding: 6,
  },
  qtyText: { fontSize: 13, fontWeight: '700', color: colors.text, minWidth: 18, textAlign: 'center' },
});
