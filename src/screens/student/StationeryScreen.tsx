import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  Image, RefreshControl, ActivityIndicator, TextInput, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, FoodItem, Order } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { addToCart, updateQuantity } from '../../store/slices/cartSlice';
import { fetchWalletBalance } from '../../store/slices/userSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { OrderQRCard } from '../../components/common/OrderQRCard';
import menuService from '../../services/menuService';
import orderService from '../../services/orderService';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Stationery'>;

const PAPER_SIZES = [
  { id: 'A4', name: 'A4', multiplier: 1 },
  { id: 'A3', name: 'A3', multiplier: 2 },
  { id: 'Letter', name: 'Letter', multiplier: 1 },
  { id: 'Legal', name: 'Legal', multiplier: 1.2 },
] as const;

type PaperSize = typeof PAPER_SIZES[number]['id'];
type ActiveTab = 'items' | 'print';

export default function StationeryScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { shopId, shopName } = route.params;
  const dispatch = useAppDispatch();
  const { items: cartItems } = useAppSelector(s => s.cart);
  const user = useAppSelector(s => s.auth.user);

  // Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('items');

  // Items tab
  const [menuItems, setMenuItems] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Print tab form
  const [pageCount, setPageCount] = useState(1);
  const [copies, setCopies] = useState(1);
  const [colorType, setColorType] = useState<'bw' | 'color'>('bw');
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [doubleSided, setDoubleSided] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  const loadMenu = useCallback(async () => {
    try {
      const items = await menuService.getShopMenu(shopId);
      setMenuItems(Array.isArray(items) ? items.filter(i => i.isAvailable) : []);
    } catch {
      // ignore silently
    }
  }, [shopId]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadMenu();
      setIsLoading(false);
    };
    init();
  }, [loadMenu]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMenu();
    setRefreshing(false);
  };

  const getCartQty = (id: string) => cartItems.find(c => c.item.id === id)?.quantity || 0;
  const totalItems = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const cartTotal = cartItems.reduce((sum, c) => sum + (c.item.offerPrice ?? c.item.price) * c.quantity, 0);

  const calculateTotal = () => {
    const basePrice = colorType === 'bw' ? 1 : 5;
    const sizeMultiplier = PAPER_SIZES.find(s => s.id === paperSize)?.multiplier || 1;
    const doubleSidedMultiplier = doubleSided ? 1.5 : 1;
    return Math.ceil(basePrice * sizeMultiplier * doubleSidedMultiplier * pageCount * copies);
  };

  const handleSubmitPrint = async () => {
    const total = calculateTotal();
    const balance = user?.balance || 0;
    if (balance < total) {
      setSubmitError(`Insufficient balance. Required: Rs. ${total}, Available: Rs. ${balance}`);
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const order = await orderService.createStationeryOrder({
        shopId,
        pageCount,
        copies,
        colorType,
        paperSize,
        doubleSided,
        specialInstructions: specialInstructions.trim() || undefined,
      });
      setCreatedOrder(order);
      dispatch(fetchWalletBalance());
      setPageCount(1);
      setCopies(1);
      setColorType('bw');
      setPaperSize('A4');
      setDoubleSided(false);
      setSpecialInstructions('');
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderItemCard = ({ item }: { item: FoodItem }) => {
    const qty = getCartQty(item.id);
    const displayPrice = item.isOffer && item.offerPrice ? item.offerPrice : item.price;
    return (
      <View style={[styles.foodCard, qty > 0 && styles.foodCardActive]}>
        <View style={styles.foodImageWrap}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.foodImage} />
          ) : (
            <View style={[styles.foodImage, styles.foodImagePlaceholder]}>
              <Icon name="document-outline" size={22} color={colors.textMuted} />
            </View>
          )}
          {item.isOffer && (
            <View style={styles.offerBadge}>
              <Text style={styles.offerBadgeText}>OFFER</Text>
            </View>
          )}
        </View>
        <View style={styles.foodInfo}>
          <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.foodDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <View style={styles.foodBottom}>
            <View style={styles.priceRow}>
              <Text style={styles.foodPrice}>Rs.{displayPrice}</Text>
              {item.isOffer && item.offerPrice ? (
                <Text style={styles.originalPrice}>Rs.{item.price}</Text>
              ) : null}
            </View>
            {qty === 0 ? (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => dispatch(addToCart({ item, shopId, shopName }))}
                activeOpacity={0.7}>
                <Icon name="add" size={16} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.qtyControl}>
                <TouchableOpacity
                  onPress={() => dispatch(updateQuantity({ itemId: item.id, quantity: qty - 1 }))}
                  style={styles.qtyBtn}>
                  <Icon name="remove" size={14} color={colors.orange500} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity
                  onPress={() => dispatch(updateQuantity({ itemId: item.id, quantity: qty + 1 }))}
                  style={styles.qtyBtn}>
                  <Icon name="add" size={14} color={colors.orange500} />
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
          <View style={styles.headerCenter}>
            <View style={styles.headerIconWrap}>
              <Icon name="document-text-outline" size={18} color={colors.orange500} />
            </View>
            <Text style={styles.headerTitle}>{shopName}</Text>
          </View>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.7}>
            <Icon name="cart-outline" size={20} color={colors.text} />
            {totalItems > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems > 9 ? '9+' : totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'items' && styles.tabActive]}
            onPress={() => setActiveTab('items')}
            activeOpacity={0.7}>
            <Icon name="storefront-outline" size={15} color={activeTab === 'items' ? '#fff' : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'items' && styles.tabTextActive]}>Shop Items</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'print' && styles.tabActive]}
            onPress={() => setActiveTab('print')}
            activeOpacity={0.7}>
            <Icon name="print-outline" size={15} color={activeTab === 'print' ? '#fff' : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'print' && styles.tabTextActive]}>Print & Xerox</Text>
          </TouchableOpacity>
        </View>

        {/* ── Items Tab ── */}
        {activeTab === 'items' && (
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.orange500} />
            </View>
          ) : (
            <FlatList
              data={menuItems}
              keyExtractor={i => i.id}
              renderItem={renderItemCard}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange500} />
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Icon name="document-outline" size={44} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>No items available</Text>
                  <Text style={styles.emptySubtitle}>Check back later for stationery items</Text>
                </View>
              }
              ListFooterComponent={totalItems > 0 ? <View style={styles.listFooter} /> : null}
            />
          )
        )}

        {/* ── Print & Xerox Tab ── */}
        {activeTab === 'print' && (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.printScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">

              {/* Section header */}
              <View style={styles.printHeader}>
                <View style={styles.printIconBox}>
                  <Icon name="document-text-outline" size={26} color={colors.orange500} />
                </View>
                <View>
                  <Text style={styles.printTitle}>Stationery Request</Text>
                  <Text style={styles.printSubtitle}>Print or photocopy documents</Text>
                </View>
              </View>

              {/* Balance card */}
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceValue}>Rs. {user?.balance || 0}</Text>
              </View>

              {/* Pages */}
              <Text style={styles.fieldLabel}>Number of Pages</Text>
              <View style={styles.counterRow}>
                <Text style={styles.counterTitle}>Pages</Text>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={[styles.counterBtn, pageCount <= 1 && styles.counterBtnDisabled]}
                    onPress={() => setPageCount(p => Math.max(1, p - 1))}
                    disabled={pageCount <= 1}
                    activeOpacity={0.7}>
                    <Icon name="remove" size={20} color={pageCount <= 1 ? colors.textMuted : colors.text} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.counterInput}
                    value={String(pageCount)}
                    onChangeText={v => setPageCount(Math.max(1, Math.min(1000, parseInt(v) || 1)))}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={styles.counterBtnAdd}
                    onPress={() => setPageCount(p => Math.min(1000, p + 1))}
                    activeOpacity={0.7}>
                    <Icon name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Copies */}
              <Text style={styles.fieldLabel}>Number of Copies</Text>
              <View style={styles.counterRow}>
                <Text style={styles.counterTitle}>Copies</Text>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={[styles.counterBtn, copies <= 1 && styles.counterBtnDisabled]}
                    onPress={() => setCopies(c => Math.max(1, c - 1))}
                    disabled={copies <= 1}
                    activeOpacity={0.7}>
                    <Icon name="remove" size={20} color={copies <= 1 ? colors.textMuted : colors.text} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.counterInput}
                    value={String(copies)}
                    onChangeText={v => setCopies(Math.max(1, Math.min(100, parseInt(v) || 1)))}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={styles.counterBtnAdd}
                    onPress={() => setCopies(c => Math.min(100, c + 1))}
                    activeOpacity={0.7}>
                    <Icon name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Print Type */}
              <Text style={styles.fieldLabel}>Print Type</Text>
              <View style={styles.printTypeRow}>
                <TouchableOpacity
                  style={[styles.printTypeBtn, colorType === 'bw' && styles.printTypeBtnActive]}
                  onPress={() => setColorType('bw')}
                  activeOpacity={0.7}>
                  <Text style={[styles.printTypeName, colorType === 'bw' && styles.printTypeNameActive]}>
                    Black & White
                  </Text>
                  <Text style={styles.printTypePrice}>Rs. 1 / page</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.printTypeBtn, colorType === 'color' && styles.printTypeBtnActive]}
                  onPress={() => setColorType('color')}
                  activeOpacity={0.7}>
                  <Text style={[styles.printTypeName, colorType === 'color' && styles.printTypeNameActive]}>
                    Color
                  </Text>
                  <Text style={styles.printTypePrice}>Rs. 5 / page</Text>
                </TouchableOpacity>
              </View>

              {/* Paper Size */}
              <Text style={styles.fieldLabel}>Paper Size</Text>
              <View style={styles.paperSizeRow}>
                {PAPER_SIZES.map(size => (
                  <TouchableOpacity
                    key={size.id}
                    style={[styles.paperSizeBtn, paperSize === size.id && styles.paperSizeBtnActive]}
                    onPress={() => setPaperSize(size.id)}
                    activeOpacity={0.7}>
                    <Text style={[styles.paperSizeText, paperSize === size.id && styles.paperSizeTextActive]}>
                      {size.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Double Sided */}
              <View style={styles.doubleSidedRow}>
                <View>
                  <Text style={styles.doubleSidedTitle}>Double Sided</Text>
                  <Text style={styles.doubleSidedSub}>Print on both sides (1.5x price)</Text>
                </View>
                <Switch
                  value={doubleSided}
                  onValueChange={setDoubleSided}
                  trackColor={{ false: colors.muted, true: colors.orange500 }}
                  thumbColor="#fff"
                />
              </View>

              {/* Special Instructions */}
              <Text style={styles.fieldLabel}>Special Instructions (Optional)</Text>
              <TextInput
                style={styles.instructionsInput}
                value={specialInstructions}
                onChangeText={setSpecialInstructions}
                placeholder="Any special requirements..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />

              {/* Error */}
              {submitError ? (
                <View style={styles.errorBanner}>
                  <Icon name="alert-circle-outline" size={18} color={colors.destructive} />
                  <Text style={styles.errorText}>{submitError}</Text>
                </View>
              ) : null}

              {/* Price Breakdown */}
              <View style={styles.breakdown}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    Base Price ({colorType === 'bw' ? 'B&W' : 'Color'})
                  </Text>
                  <Text style={styles.breakdownValue}>Rs. {colorType === 'bw' ? 1 : 5} / page</Text>
                </View>
                {(paperSize === 'A3' || paperSize === 'Legal') && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Paper Size ({paperSize})</Text>
                    <Text style={styles.breakdownValue}>
                      x{PAPER_SIZES.find(s => s.id === paperSize)?.multiplier}
                    </Text>
                  </View>
                )}
                {doubleSided && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Double Sided</Text>
                    <Text style={styles.breakdownValue}>x1.5</Text>
                  </View>
                )}
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Pages × Copies</Text>
                  <Text style={styles.breakdownValue}>{pageCount} × {copies}</Text>
                </View>
              </View>

              {/* Summary & Submit */}
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryLabel}>Total Pages</Text>
                  <Text style={styles.summaryPages}>{pageCount * copies} pages</Text>
                </View>
                <View style={styles.summaryRight}>
                  <Text style={styles.summaryLabel}>Total Amount</Text>
                  <Text style={styles.summaryAmount}>Rs. {calculateTotal()}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                onPress={handleSubmitPrint}
                disabled={isSubmitting}
                activeOpacity={0.8}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="print-outline" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>Place Stationery Order</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.printBottomSpacer} />
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* Floating Cart Bar (items tab only) */}
        {activeTab === 'items' && totalItems > 0 && (
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

      {/* Order QR Modal after successful print order */}
      {createdOrder && (
        <OrderQRCard order={createdOrder} onClose={() => setCreatedOrder(null)} />
      )}
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 6, marginRight: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(249,115,22,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cartBtn: {
    width: 38, height: 38, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  cartBadge: {
    position: 'absolute', top: 2, right: 2, width: 16, height: 16,
    borderRadius: 8, backgroundColor: colors.orange500,
    justifyContent: 'center', alignItems: 'center',
  },
  cartBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Tabs
  tabs: {
    flexDirection: 'row', marginHorizontal: 16, marginVertical: 12,
    backgroundColor: colors.muted, borderRadius: 14, padding: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  tabActive: { backgroundColor: colors.orange500 },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: '#fff' },

  // Items list
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 20 },
  listFooter: { height: 100 },
  foodCard: {
    flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  foodCardActive: {
    borderColor: 'rgba(249,115,22,0.4)',
    backgroundColor: 'rgba(249,115,22,0.05)',
  },
  foodImageWrap: { position: 'relative' },
  foodImage: { width: 56, height: 56, borderRadius: 10 },
  foodImagePlaceholder: {
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  offerBadge: {
    position: 'absolute', top: 2, left: 2,
    backgroundColor: colors.orange500, borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  offerBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  foodInfo: { flex: 1, justifyContent: 'space-between' },
  foodName: { fontSize: 13, fontWeight: '600', color: colors.text },
  foodDesc: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  foodBottom: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 6,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  foodPrice: { fontSize: 13, fontWeight: '700', color: colors.orange500 },
  originalPrice: { fontSize: 11, color: colors.textMuted, textDecorationLine: 'line-through' },
  addBtn: { backgroundColor: colors.orange500, borderRadius: 8, padding: 5 },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 8, overflow: 'hidden',
  },
  qtyBtn: { padding: 4 },
  qtyText: { fontSize: 12, fontWeight: '700', color: colors.text, width: 20, textAlign: 'center' },
  empty: { alignItems: 'center', paddingTop: 70, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted },

  // Print tab
  printScroll: { padding: 20 },
  printHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20,
  },
  printIconBox: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  printTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  printSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  balanceCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: colors.card,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 20,
  },
  balanceLabel: { fontSize: 13, color: colors.textMuted },
  balanceValue: { fontSize: 18, fontWeight: '800', color: colors.primary },

  fieldLabel: {
    fontSize: 11, fontWeight: '600', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },

  counterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: colors.card,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 20,
  },
  counterTitle: { fontSize: 15, fontWeight: '500', color: colors.text },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.muted,
    justifyContent: 'center', alignItems: 'center',
  },
  counterBtnDisabled: { opacity: 0.4 },
  counterBtnAdd: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.orange500,
    justifyContent: 'center', alignItems: 'center',
  },
  counterInput: {
    width: 60, height: 40, textAlign: 'center',
    backgroundColor: colors.muted, borderRadius: 12,
    fontSize: 16, fontWeight: '700', color: colors.text,
  },

  printTypeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  printTypeBtn: {
    flex: 1, padding: 16, borderRadius: 16,
    borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  printTypeBtnActive: {
    borderColor: colors.orange500,
    backgroundColor: 'rgba(249,115,22,0.08)',
  },
  printTypeName: { fontSize: 14, fontWeight: '600', color: colors.text },
  printTypeNameActive: { color: colors.orange500 },
  printTypePrice: { fontSize: 12, color: colors.orange500, marginTop: 4 },

  paperSizeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  paperSizeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.card, alignItems: 'center',
  },
  paperSizeBtnActive: {
    borderColor: colors.orange500,
    backgroundColor: 'rgba(249,115,22,0.08)',
  },
  paperSizeText: { fontSize: 13, fontWeight: '600', color: colors.text },
  paperSizeTextActive: { color: colors.orange500 },

  doubleSidedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: colors.card,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 20,
  },
  doubleSidedTitle: { fontSize: 15, fontWeight: '500', color: colors.text },
  doubleSidedSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  instructionsInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    padding: 14, minHeight: 100,
    backgroundColor: colors.card,
    fontSize: 14, color: colors.text, marginBottom: 20,
  },

  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 14, borderRadius: 16,
    backgroundColor: colors.errorBg,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, color: colors.destructive },

  breakdown: {
    backgroundColor: colors.muted, borderRadius: 16, padding: 16, marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6,
  },
  breakdownLabel: { fontSize: 13, color: colors.textMuted },
  breakdownValue: { fontSize: 13, color: colors.text, fontWeight: '500' },

  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, marginBottom: 20,
  },
  summaryRight: { alignItems: 'flex-end' },
  summaryLabel: { fontSize: 12, color: colors.textMuted },
  summaryPages: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 2 },
  summaryAmount: { fontSize: 26, fontWeight: '800', color: colors.orange500 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 56, borderRadius: 18, backgroundColor: colors.orange500,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  printBottomSpacer: { height: 40 },

  // Floating cart bar
  floatingBar: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.orange500, borderRadius: 20, padding: 14,
    shadowColor: colors.orange500, shadowOffset: { width: 0, height: 8 },
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
  floatingBarBadgeText: { fontSize: 10, fontWeight: '800', color: colors.orange500 },
  floatingBarSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  floatingBarTotal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  floatingBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  floatingBarAction: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
