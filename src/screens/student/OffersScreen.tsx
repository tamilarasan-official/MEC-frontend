import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, FoodItem } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
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
import menuService from '../../services/menuService';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Offers'>;

export default function OffersScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();

  const { items: cartItems } = useAppSelector(s => s.cart);
  const [offerItems, setOfferItems] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOffers = useCallback(async () => {
    try {
      const data = await menuService.getOffers();
      setOfferItems(Array.isArray(data) ? data : []);
    } catch {
      // ignore silently
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadOffers();
      setIsLoading(false);
    };
    init();
  }, [loadOffers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOffers();
    setRefreshing(false);
  };

  const getCartQty = (id: string) => cartItems.find(c => c.item.id === id)?.quantity || 0;
  const totalItems = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const cartTotal = cartItems.reduce((sum, c) => sum + (c.item.offerPrice ?? c.item.price) * c.quantity, 0);

  const renderOffer = ({ item, index }: { item: FoodItem; index: number }) => {
    const qty = getCartQty(item.id);
    const discount = item.offerPrice ? Math.round((1 - item.offerPrice / item.price) * 100) : 0;
    const shopId = item.shopId || '';
    const shopName = item.shopName || 'Canteen';

    return (
      <View style={[styles.offerCard, index === 0 && styles.offerCardFirst]}>
        {/* Image */}
        <View style={styles.offerImageWrap}>
          {item.image ? (
            <Image source={{ uri: resolveImageUrl(item.image)! }} style={styles.offerImage} />
          ) : (
            <View style={[styles.offerImage, styles.offerImagePlaceholder]}>
              <Icon name="restaurant-outline" size={30} color={colors.textMuted} />
            </View>
          )}
          {/* Discount badge */}
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}% OFF</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.offerInfo}>
          <View style={styles.offerInfoTop}>
            <Text style={styles.offerName} numberOfLines={1}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.offerDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
          </View>

          <View style={styles.offerBottom}>
            <View style={styles.offerPriceBlock}>
              <Text style={styles.offerPrice}>Rs.{item.offerPrice}</Text>
              <Text style={styles.offerOriginal}>Rs.{item.price}</Text>
            </View>

            {qty === 0 ? (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => dispatch(addToCart({ item, shopId, shopName }))}
                activeOpacity={0.7}>
                <Icon name="add" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.qtyControl}>
                <TouchableOpacity
                  onPress={() => dispatch(updateQuantity({ itemId: item.id, quantity: qty - 1 }))}
                  style={styles.qtyBtn}
                  activeOpacity={0.7}>
                  <Icon name="remove" size={14} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity
                  onPress={() => dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 }))}
                  style={styles.qtyBtn}
                  activeOpacity={0.7}>
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Today's Offers</Text>
          {totalItems > 0 ? (
            <TouchableOpacity
              style={styles.cartBtn}
              onPress={() => navigation.navigate('Cart')}
              activeOpacity={0.7}>
              <Icon name="cart-outline" size={20} color={colors.text} />
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems > 9 ? '9+' : totalItems}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {isLoading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={offerItems}
            keyExtractor={i => i.id}
            renderItem={renderOffer}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListHeaderComponent={
              <>
                {/* Promo banner */}
                <View style={styles.promoBanner}>
                  <View style={styles.promoOverlay} />
                  <View style={styles.promoContent}>
                    <View style={styles.promoPill}>
                      <Icon name="pricetag-outline" size={12} color="#fff" />
                      <Text style={styles.promoPillText}>Limited Time Only</Text>
                    </View>
                    <Text style={styles.promoHeading}>Up to 30% OFF</Text>
                    <Text style={styles.promoSub}>On selected items across all shops</Text>
                  </View>
                  {/* decorative blobs */}
                  <View style={styles.promoBlobRight} />
                  <View style={styles.promoBlobTop} />
                </View>

                {/* Section title */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {offerItems.length} offer{offerItems.length !== 1 ? 's' : ''} available
                  </Text>
                  <Text style={styles.sectionSub}>Grab these deals before they're gone!</Text>
                </View>
              </>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <Icon name="pricetag-outline" size={34} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No offers available</Text>
                <Text style={styles.emptySubtitle}>Check back later for exciting deals!</Text>
              </View>
            }
            ListFooterComponent={totalItems > 0 ? <View style={styles.listFooter} /> : null}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerSpacer: { width: 38 },
  cartBtn: {
    width: 38, height: 38, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  cartBadge: {
    position: 'absolute', top: 2, right: 2, width: 16, height: 16,
    borderRadius: 8, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  cartBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // List
  list: { paddingBottom: 20 },
  listFooter: { height: 100 },

  // Promo banner
  promoBanner: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 20,
    borderRadius: 22, overflow: 'hidden',
    backgroundColor: colors.primary, minHeight: 130,
    justifyContent: 'center',
  },
  promoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  promoContent: { padding: 20, zIndex: 1 },
  promoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)', alignSelf: 'flex-start', marginBottom: 10,
  },
  promoPillText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  promoHeading: { fontSize: 28, fontWeight: '900', color: '#fff' },
  promoSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  promoBlobRight: {
    position: 'absolute', right: -50, bottom: -50,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  promoBlobTop: {
    position: 'absolute', right: 30, top: 10,
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Section header
  sectionHeader: { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sectionSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  // Offer cards
  offerCard: {
    flexDirection: 'row', gap: 14, padding: 14,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: colors.card, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border,
  },
  offerCardFirst: { marginTop: 0 },
  offerImageWrap: { position: 'relative', flexShrink: 0 },
  offerImage: { width: 100, height: 100, borderRadius: 14 },
  offerImagePlaceholder: {
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },
  discountBadge: {
    position: 'absolute', top: -6, left: -6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  discountText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  offerInfo: { flex: 1, justifyContent: 'space-between', paddingVertical: 2 },
  offerInfoTop: {},
  offerName: { fontSize: 15, fontWeight: '600', color: colors.text },
  offerDesc: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  offerBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8,
  },
  offerPriceBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  offerPrice: { fontSize: 20, fontWeight: '800', color: colors.primary },
  offerOriginal: { fontSize: 13, color: colors.textMuted, textDecorationLine: 'line-through' },
  addBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primaryBg, borderRadius: 12,
    borderWidth: 1, borderColor: colors.primaryBorder, overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  qtyText: { fontSize: 14, fontWeight: '700', color: colors.text, width: 24, textAlign: 'center' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted },

  // Floating cart bar
  floatingBar: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary, borderRadius: 20, padding: 14,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  floatingBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  floatingBarIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  floatingBarBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#fff', borderRadius: 10, width: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  floatingBarBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  floatingBarSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  floatingBarTotal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  floatingBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  floatingBarAction: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
