import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Image, RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, FoodItem } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchShopMenu, fetchShopCategories } from '../../store/slices/menuSlice';
import { addToCart, updateQuantity } from '../../store/slices/cartSlice';

const IMAGE_BASE = 'https://backend.mec.welocalhost.com';
function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${IMAGE_BASE}${url}`;
}
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Menu'>;

export default function MenuScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { shopId, shopName } = route.params;
  const dispatch = useAppDispatch();
  const { menuItems: shopMenu, isLoading: menuLoading, categories } = useAppSelector(s => s.menu);
  const { items: cartItems } = useAppSelector(s => s.cart);
  const { dietFilter } = useAppSelector(s => s.user);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchShopMenu({ shopId }));
    dispatch(fetchShopCategories(shopId));
  }, [dispatch, shopId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchShopMenu({ shopId }));
    setRefreshing(false);
  };

  const filteredItems = useMemo(() => {
    return shopMenu.filter((item: FoodItem) => {
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesDiet = dietFilter === 'all' || (dietFilter === 'veg' && item.isVeg) || (dietFilter === 'nonveg' && !item.isVeg);
      const matchesSearch = !searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && item.isAvailable && matchesDiet && matchesSearch;
    });
  }, [shopMenu, selectedCategory, dietFilter, searchQuery]);

  const offerItems = useMemo(() => filteredItems.filter((i: FoodItem) => i.isOffer), [filteredItems]);

  const getCartQty = (id: string) => cartItems.find(c => c.item.id === id)?.quantity || 0;
  const totalItems = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const cartTotal = cartItems.reduce((sum, c) => sum + (c.item.offerPrice ?? c.item.price) * c.quantity, 0);

  // Ensure categories are strings (API may return objects)
  const allCategories = ['All', ...categories.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean)];

  const renderFoodCard = ({ item }: { item: FoodItem }) => {
    const qty = getCartQty(item.id);
    const displayPrice = item.isOffer && item.offerPrice ? item.offerPrice : item.price;

    return (
      <View style={styles.foodCard}>
        <TouchableOpacity
          style={styles.foodImageWrap}
          onPress={() => qty === 0 ? dispatch(addToCart({ item, shopId, shopName })) : dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 }))}
          activeOpacity={0.8}>
          {item.image ? (
            <Image source={{ uri: resolveImageUrl(item.image)! }} style={styles.foodImage} />
          ) : (
            <View style={[styles.foodImage, styles.foodImagePlaceholder]}>
              <Icon name="restaurant-outline" size={22} color={colors.textMuted} />
            </View>
          )}
          {item.isOffer && (
            <View style={styles.offerBadge}>
              <Text style={styles.offerBadgeText}>OFFER</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.foodInfo}>
          <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.foodBottom}>
            <Text style={styles.foodPrice}>Rs.{displayPrice}</Text>
            {qty === 0 ? (
              <TouchableOpacity style={styles.addBtn} onPress={() => dispatch(addToCart({ item, shopId, shopName }))} activeOpacity={0.7}>
                <Icon name="add" size={16} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.qtyControl}>
                <TouchableOpacity onPress={() => dispatch(updateQuantity({ itemId: item.id, quantity: qty - 1 }))} style={styles.qtyBtn}>
                  <Icon name="remove" size={14} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity onPress={() => dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 }))} style={styles.qtyBtn}>
                  <Icon name="add" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{shopName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search items..."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cats} contentContainerStyle={styles.catsContent}>
        {allCategories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catPill, selectedCategory === cat && styles.catPillActive]}
            onPress={() => setSelectedCategory(cat)}
            activeOpacity={0.7}>
            <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {menuLoading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={i => i.id}
          renderItem={renderFoodCard}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            offerItems.length > 0 ? (
              <View style={styles.offersSection}>
                <Text style={styles.sectionTitle}>Today's Special</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offerListContent}>
                  {offerItems.map((item: FoodItem) => {
                    const discount = item.offerPrice ? Math.round((1 - item.offerPrice / item.price) * 100) : 0;
                    return (
                      <TouchableOpacity key={item.id} style={styles.offerCard} onPress={() => dispatch(addToCart({ item, shopId, shopName }))} activeOpacity={0.8}>
                        <View style={styles.offerDiscountBadge}><Text style={styles.offerDiscountText}>{discount}% OFF</Text></View>
                        {item.image ? (
                          <Image source={{ uri: resolveImageUrl(item.image)! }} style={styles.offerImage} />
                        ) : (
                          <View style={[styles.offerImage, styles.foodImagePlaceholder]}>
                            <Icon name="restaurant-outline" size={24} color={colors.textMuted} />
                          </View>
                        )}
                        <View style={styles.offerCardBody}>
                          <Text style={styles.offerName} numberOfLines={1}>{item.name}</Text>
                          <View style={styles.offerPriceRow}>
                            <Text style={styles.offerPrice}>Rs.{item.offerPrice}</Text>
                            <Text style={styles.offerOriginal}>Rs.{item.price}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="search" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySubtitle}>{searchQuery ? `No items match "${searchQuery}"` : 'No items available'}</Text>
            </View>
          }
          ListFooterComponent={totalItems > 0 ? <View style={styles.bottomSpacer} /> : null}
        />
      )}

      {/* Floating Cart Bar */}
      {totalItems > 0 && (
        <TouchableOpacity
          style={styles.floatingBar}
          onPress={() => navigation.navigate('Cart')}
          activeOpacity={0.9}>
          <View style={styles.floatingBarLeft}>
            <View style={styles.floatingBarIcon}>
              <Icon name="bag-handle" size={22} color="#fff" />
              <View style={styles.floatingBarBadge}>
                <Text style={styles.floatingBarBadgeText}>{totalItems}</Text>
              </View>
            </View>
            <View>
              <Text style={styles.floatingBarSub}>{totalItems} item{totalItems > 1 ? 's' : ''}</Text>
              <Text style={styles.floatingBarTotal}>Rs. {cartTotal}</Text>
            </View>
          </View>
          <View style={styles.floatingBarRight}>
            <Text style={styles.floatingBarAction}>View Cart</Text>
            <Icon name="arrow-forward" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      )}
    </View>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8,
    backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  cats: { maxHeight: 44, marginBottom: 4 },
  catsContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  catPill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  catPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { fontSize: 13, fontWeight: '500', color: colors.text },
  catTextActive: { color: '#fff', fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  foodCard: {
    flexDirection: 'row', gap: 10, padding: 8, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  foodImageWrap: { position: 'relative' },
  foodImage: { width: 56, height: 56, borderRadius: 10 },
  foodImagePlaceholder: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  offerBadge: { position: 'absolute', top: 2, left: 2, backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  offerBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  foodInfo: { flex: 1, justifyContent: 'space-between' },
  foodName: { fontSize: 13, fontWeight: '500', color: colors.text },
  foodBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  foodPrice: { fontSize: 12, fontWeight: '700', color: colors.primary },
  addBtn: { backgroundColor: colors.primary, borderRadius: 8, padding: 4 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 8, overflow: 'hidden' },
  qtyBtn: { padding: 4 },
  qtyText: { fontSize: 12, fontWeight: '700', color: colors.text, width: 20, textAlign: 'center' },
  offersSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  offerCard: { width: 180, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  offerImage: { width: '100%', height: 100 },
  offerDiscountBadge: { position: 'absolute', top: 10, left: 10, zIndex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  offerDiscountText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  offerName: { fontSize: 13, fontWeight: '600', color: colors.text },
  offerPrice: { fontSize: 14, fontWeight: '700', color: colors.primary },
  offerOriginal: { fontSize: 11, color: colors.textMuted, textDecorationLine: 'line-through' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted },
  floatingBar: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary, borderRadius: 20, padding: 14,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  floatingBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  floatingBarIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  floatingBarBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#fff', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  floatingBarBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  floatingBarSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  floatingBarTotal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  floatingBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  floatingBarAction: { fontSize: 15, fontWeight: '700', color: '#fff' },
  headerSpacer: { width: 36 },
  offerListContent: { gap: 12 },
  offerCardBody: { padding: 10 },
  offerPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  bottomSpacer: { height: 100 },
});
