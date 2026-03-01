import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Image,
  ActivityIndicator, RefreshControl, Modal, Alert, Platform,
  ScrollView, Pressable, Dimensions,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { RootState, AppDispatch } from '../../store';
import {
  fetchOwnerMenu, createMenuItem, updateMenuItem, deleteMenuItem,
  toggleItemAvailability, setItemOffer, removeItemOffer,
} from '../../store/slices/menuSlice';
import { fetchDashboardStats } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { FoodItem } from '../../types';
import { CATEGORIES } from '../../constants';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import OwnerHeader from '../../components/owner/OwnerHeader';
import OwnerProfileDropdown from '../../components/owner/OwnerProfileDropdown';
import OwnerWalletModal from '../../components/owner/OwnerWalletModal';
import api from '../../services/api';

const IMAGE_BASE = 'https://backend.mec.welocalhost.com';
function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.includes('/placeholder')) return null;
  if (url.startsWith('http')) return url;
  return `${IMAGE_BASE}${url}`;
}

export default function OwnerMenuScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const ownerMenuItems = useSelector((s: RootState) => s.menu.ownerMenuItems);
  const ownerMenuLoading = useSelector((s: RootState) => s.menu.ownerMenuLoading);
  const ownerMenuLastFetched = useSelector((s: RootState) => s.menu.ownerMenuLastFetched);
  const ownerCategories = useSelector((s: RootState) => s.menu.ownerCategories);
  const dashboardStats = useSelector((s: RootState) => s.user.dashboardStats);
  const [showProfile, setShowProfile] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showHeaderSearch, setShowHeaderSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showCategoriesSection, setShowCategoriesSection] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [offerModal, setOfferModal] = useState<FoodItem | null>(null);
  const [discountPercent, setDiscountPercent] = useState('');

  const loadMenu = useCallback(async (force = false) => {
    // Skip re-fetch if data was loaded less than 30s ago (unless forced)
    if (!force && ownerMenuLastFetched > 0 && Date.now() - ownerMenuLastFetched < 30000) return;
    await dispatch(fetchOwnerMenu());
  }, [dispatch, ownerMenuLastFetched]);

  useEffect(() => { loadMenu(); }, [loadMenu]);
  useEffect(() => { if (!dashboardStats) dispatch(fetchDashboardStats()); }, [dashboardStats, dispatch]);

  const onRefresh = async () => { setRefreshing(true); await loadMenu(true); setRefreshing(false); };

  // Filter
  const filtered = useMemo(() => {
    let result = ownerMenuItems;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    if (categoryFilter) {
      result = result.filter(i => i.category === categoryFilter);
    }
    return result;
  }, [ownerMenuItems, search, categoryFilter]);

  const categories = useMemo(() => {
    const fromItems = ownerMenuItems.map(i => i.category).filter(Boolean);
    const fromApi = ownerCategories.map(c => c.name).filter(Boolean);
    return [...new Set([...fromApi, ...fromItems])];
  }, [ownerMenuItems, ownerCategories]);

  const handleToggleAvailability = useCallback((item: FoodItem) => {
    dispatch(toggleItemAvailability({ itemId: item.id, isAvailable: !item.isAvailable }));
  }, [dispatch]);

  const handleDelete = useCallback((item: FoodItem) => {
    Alert.alert('Delete Item', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => dispatch(deleteMenuItem(item.id)) },
    ]);
  }, [dispatch]);

  const handleOfferSubmit = () => {
    if (!offerModal) return;
    const pct = parseFloat(discountPercent);
    if (!pct || pct <= 0 || pct > 100) {
      Alert.alert('Invalid', 'Discount must be between 1% and 100%.');
      return;
    }
    dispatch(setItemOffer({ itemId: offerModal.id, discountPercent: pct, price: offerModal.price }));
    setOfferModal(null);
    setDiscountPercent('');
  };

  const handleRemoveOffer = useCallback((item: FoodItem) => {
    dispatch(removeItemOffer(item.id));
  }, [dispatch]);

  const renderItem = useCallback(({ item }: { item: FoodItem }) => (
    <MenuItemCard
      item={item}
      colors={colors}
      styles={styles}
      onToggle={handleToggleAvailability}
      onEdit={(it) => { setEditingItem(it); setShowAddModal(true); }}
      onDelete={handleDelete}
      onOffer={(it) => { setOfferModal(it); setDiscountPercent(''); }}
      onRemoveOffer={handleRemoveOffer}
    />
  ), [colors, styles, handleToggleAvailability, handleDelete, handleRemoveOffer]);

  const keyExtractor = useCallback((item: FoodItem) => item.id, []);

  // Dismiss category dropdown when tapping outside
  const dismissDropdown = useCallback(() => {
    if (showCategoryDropdown) setShowCategoryDropdown(false);
  }, [showCategoryDropdown]);

  return (
    <ScreenWrapper>
      <OwnerHeader
        searchQuery={showHeaderSearch ? search : ''}
        onSearchChange={setSearch}
        showSearch={showHeaderSearch}
        onToggleSearch={() => { setShowHeaderSearch(!showHeaderSearch); if (showHeaderSearch) setSearch(''); }}
        onProfilePress={() => setShowProfile(true)}
        todayRevenue={dashboardStats?.todayRevenue ?? 0}
        onAnalyticsPress={() => navigation.navigate('Analytics')}
        onRevenuePress={() => setShowWallet(true)}
      />

      <View style={styles.container}>
        {/* Header section - outside FlatList so dropdown renders on top */}
        <View style={styles.headerSection}>
          {/* Top row: item count + Add Item */}
          <View style={styles.topRow}>
            <Text style={styles.itemCount}>
              {ownerMenuItems.length} item{ownerMenuItems.length !== 1 ? 's' : ''} in your menu
            </Text>
            <TouchableOpacity
              style={styles.addItemBtn}
              onPress={() => { setEditingItem(null); setShowAddModal(true); }}
              activeOpacity={0.7}
            >
              <Icon name="add" size={16} color="#fff" />
              <Text style={styles.addItemText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {/* Search + Category Dropdown */}
          <View style={styles.filterRow}>
            <View style={styles.searchBox}>
              <Icon name="search-outline" size={16} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search items..."
                placeholderTextColor={colors.mutedForeground}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Icon name="close-circle" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>

            {categories.length > 0 && (
              <View style={styles.categoryDropdownWrap}>
                <TouchableOpacity
                  style={styles.categoryDropdown}
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.categoryDropdownText} numberOfLines={1}>
                    {categoryFilter || 'All categories'}
                  </Text>
                  <Icon name="chevron-down" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>

                {showCategoryDropdown && (
                  <ScrollView style={styles.dropdownMenu} nestedScrollEnabled>
                    <TouchableOpacity
                      style={[styles.dropdownItem, !categoryFilter && styles.dropdownItemActive]}
                      onPress={() => { setCategoryFilter(null); setShowCategoryDropdown(false); }}
                    >
                      <Text style={[styles.dropdownItemText, !categoryFilter && styles.dropdownItemTextActive]}>
                        All categories
                      </Text>
                    </TouchableOpacity>
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.dropdownItem, categoryFilter === cat && styles.dropdownItemActive]}
                        onPress={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
                      >
                        <Text style={[styles.dropdownItemText, categoryFilter === cat && styles.dropdownItemTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Items list */}
        {ownerMenuLoading && filtered.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loaderMargin} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            onScrollBeginDrag={dismissDropdown}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Icon name="restaurant-outline" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>No menu items found</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => { setEditingItem(null); setShowAddModal(true); }}
                >
                  <Icon name="add" size={18} color="#fff" />
                  <Text style={styles.emptyBtnText}>Add First Item</Text>
                </TouchableOpacity>
              </View>
            }
            ListFooterComponent={<View style={styles.bottomSpacer} />}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={7}
            initialNumToRender={8}
          />
        )}

        {/* Add/Edit Modal */}
        <AddEditModal
          visible={showAddModal}
          item={editingItem}
          categories={categories}
          categoryObjects={ownerCategories}
          onClose={() => { setShowAddModal(false); setEditingItem(null); }}
          onSave={(data) => {
            if (editingItem) {
              dispatch(updateMenuItem({ itemId: editingItem.id, data }));
            } else {
              dispatch(createMenuItem(data));
            }
            setShowAddModal(false);
            setEditingItem(null);
            // Refresh menu after save
            setTimeout(() => dispatch(fetchOwnerMenu()), 500);
          }}
        />

        {/* Offer Price Modal */}
        <Modal visible={!!offerModal} transparent animationType="fade" onRequestClose={() => setOfferModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.offerModalContent}>
              <Text style={styles.offerTitle}>Set Discount Offer</Text>
              <Text style={styles.offerSub}>Regular price: Rs.{offerModal?.price}</Text>
              <TextInput
                style={styles.offerInput}
                placeholder="Enter discount % (e.g. 15)"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={discountPercent}
                onChangeText={setDiscountPercent}
              />
              <View style={styles.offerActions}>
                <TouchableOpacity style={styles.offerCancel} onPress={() => setOfferModal(null)}>
                  <Text style={styles.offerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.offerSubmit} onPress={handleOfferSubmit}>
                  <Text style={styles.offerSubmitText}>Set Offer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>

      <OwnerProfileDropdown visible={showProfile} onClose={() => setShowProfile(false)} onOpenWallet={() => setShowWallet(true)} />
      <OwnerWalletModal visible={showWallet} onClose={() => setShowWallet(false)} />
    </ScreenWrapper>
  );
}

/* ----------- Menu Item Card (memoized for FlatList perf) ----------- */
const MenuItemCard = React.memo(function MenuItemCard({
  item, colors, styles, onToggle, onEdit, onDelete, onOffer, onRemoveOffer,
}: {
  item: FoodItem;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onToggle: (i: FoodItem) => void;
  onEdit: (i: FoodItem) => void;
  onDelete: (i: FoodItem) => void;
  onOffer: (i: FoodItem) => void;
  onRemoveOffer: (i: FoodItem) => void;
}) {
  const imageUri = resolveImageUrl(item.image);

  return (
    <View style={[styles.card, !item.isAvailable && styles.cardUnavailable]}>
      {/* Image + Veg badge */}
      <View style={styles.cardImageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Icon name="restaurant-outline" size={24} color={colors.mutedForeground} />
          </View>
        )}
        {item.isVeg && (
          <View style={styles.vegBadge}>
            <Icon name="leaf" size={10} color="#fff" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemCategory}>{item.category}</Text>
        <View style={styles.priceRow}>
          {item.isOffer && item.offerPrice ? (
            <>
              <Text style={styles.priceText}>Rs. {item.price}</Text>
              <Text style={styles.offerPriceInline}>{'\u00B7'} Rs.{item.offerPrice}</Text>
            </>
          ) : (
            <Text style={styles.priceText}>Rs. {item.price}</Text>
          )}
          {item.costPrice != null && item.costPrice >= 0 && (
            <Text style={[
              styles.profitInline,
              { color: (item.price - item.costPrice) >= 0 ? '#10b981' : '#ef4444' },
            ]}>
              {'\u00B7'} {(item.price - item.costPrice) >= 0 ? '+' : ''}{'\u20B9'}{Math.round(item.price - item.costPrice)}
            </Text>
          )}
          {item.preparationTime ? (
            <Text style={styles.prepTime}>{'\u00B7'} {item.preparationTime}</Text>
          ) : null}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(item)}>
          <Icon name="create-outline" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete(item)}>
          <Icon name="trash-outline" size={16} color={colors.destructive} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.cardToggleSwitch,
            item.isAvailable ? styles.cardToggleSwitchOn : styles.cardToggleSwitchOff,
          ]}
          onPress={() => onToggle(item)}
          activeOpacity={0.7}
        >
          <View style={[
            styles.cardToggleDot,
            item.isAvailable ? styles.cardToggleDotOn : styles.cardToggleDotOff,
          ]}>
            {item.isAvailable ? (
              <Icon name="checkmark" size={12} color="#3b82f6" />
            ) : (
              <Icon name="close" size={12} color={colors.mutedForeground} />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
});

/* ----------- Add/Edit Modal (redesigned to match web) ----------- */
function AddEditModal({
  visible, item, categories: existingCategories, categoryObjects, onClose, onSave,
}: {
  visible: boolean;
  item: FoodItem | null;
  categories: string[];
  categoryObjects: Array<{ id: string; name: string; isReadyServe?: boolean }>;
  onClose: () => void;
  onSave: (data: Partial<FoodItem>) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [preparationTime, setPreparationTime] = useState('');
  const [isVeg, setIsVeg] = useState(false);
  const [isInstant, setIsInstant] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);

  // Use API category objects if available, fallback to string categories
  const displayCategories = useMemo(() => {
    if (categoryObjects.length > 0) {
      return categoryObjects.map(c => ({ id: c.id, name: c.name, isReadyServe: c.isReadyServe }));
    }
    // Fallback: merge CATEGORIES constant with existingCategories
    const merged = new Set([...CATEGORIES, ...existingCategories]);
    return [...merged].map(name => ({ id: '', name, isReadyServe: false }));
  }, [categoryObjects, existingCategories]);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description || '');
      setPrice(item.price.toString());
      setCostPrice(item.costPrice?.toString() || '');
      setCategory(item.category || '');
      // Find matching category object to get its ID
      const matchedCat = categoryObjects.find(
        c => c.name === item.category || c.id === item.category,
      );
      setCategoryId(matchedCat?.id || '');
      setCustomCategory('');
      const pt = item.preparationTime;
      setPreparationTime(pt ? pt.replace(/[^0-9]/g, '') : '');
      setIsVeg(item.isVeg ?? false);
      setIsInstant(item.isInstant ?? false);
      setIsAvailable(item.isAvailable ?? true);
      setImageUrl(item.image || '');
    } else {
      setName(''); setDescription(''); setPrice(''); setCostPrice('');
      setCategory(''); setCategoryId(''); setCustomCategory(''); setPreparationTime('');
      setIsVeg(false); setIsInstant(false); setIsAvailable(true); setImageUrl('');
    }
  }, [item, visible, categoryObjects]);

  const handlePickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
        includeBase64: true,
      });

      if (result.didCancel || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Error', 'Failed to read image data.');
        return;
      }

      setImageUploading(true);
      try {
        const res = await api.post('/uploads/image', {
          image: `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`,
          filename: asset.fileName || 'menu-item.jpg',
          folder: 'menu',
        });
        const uploadedUrl = res.data?.data?.url || res.data?.url || res.data?.data?.imageUrl || res.data?.imageUrl;
        if (uploadedUrl) {
          setImageUrl(uploadedUrl);
        } else {
          Alert.alert('Error', 'Failed to upload image. Please try again.');
        }
      } catch (err) {
        console.error('Image upload failed:', err);
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      } finally {
        setImageUploading(false);
      }
    } catch (err) {
      console.error('Image picker error:', err);
    }
  };

  const handleSelectCategory = (cat: { id: string; name: string }) => {
    setCategory(cat.name);
    setCategoryId(cat.id);
    setShowCatDropdown(false);
  };

  const handleSubmit = () => {
    const finalCategoryName = customCategory.trim() || category;
    if (!name.trim() || !price.trim()) {
      Alert.alert('Required', 'Name and selling price are required.');
      return;
    }
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) { Alert.alert('Invalid', 'Enter a valid selling price.'); return; }

    if (preparationTime) {
      const pt = parseInt(preparationTime, 10);
      if (isNaN(pt) || pt < 1 || pt > 180) {
        Alert.alert('Invalid', 'Preparation time must be between 1 and 180 minutes.');
        return;
      }
    }

    // Send both category name and categoryId — backend uses whichever it needs
    const data: any = {
      name: name.trim(),
      description: description.trim(),
      price: p,
      costPrice: costPrice ? parseFloat(costPrice) : undefined,
      category: finalCategoryName || 'Uncategorized',
      preparationTime: preparationTime ? `${preparationTime}` : undefined,
      isVeg,
      isInstant,
      isAvailable,
      image: imageUrl || undefined,
    };
    // If we have a categoryId from dropdown, include it
    if (categoryId) data.categoryId = categoryId;

    onSave(data);
  };

  // Profit calculation
  const profitInfo = useMemo(() => {
    if (!price || !costPrice) return null;
    const selling = parseFloat(price);
    const cost = parseFloat(costPrice);
    if (isNaN(selling) || isNaN(cost) || selling <= 0 || cost < 0) return null;
    const profit = selling - cost;
    return { profit, isPositive: profit >= 0 };
  }, [price, costPrice]);

  const resolvedImageUri = resolveImageUrl(imageUrl);

  const screenHeight = Dimensions.get('window').height;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Backdrop dismiss */}
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        {/* Form content */}
        <View style={[styles.formModal, { maxHeight: screenHeight * 0.92 }]}>
          {/* Header */}
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{item ? 'Edit Item' : 'Add New Item'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.formCloseBtn}>
              <Icon name="close" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <View>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder="Item name"
                placeholderTextColor={colors.mutedForeground}
                maxLength={100}
              />
            </View>

            {/* Description */}
            <View>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Brief description (optional)"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={500}
              />
            </View>

            {/* Selling Price / Cost Price */}
            <View style={styles.formPriceRow}>
              <View style={styles.flex1}>
                <Text style={styles.fieldLabel}>Selling Price (Rs.) *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.fieldLabel}>Cost Price (Rs.)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={costPrice}
                  onChangeText={setCostPrice}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Profit indicator */}
            {profitInfo && (
              <View style={[
                styles.profitIndicator,
                { borderColor: profitInfo.isPositive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                  backgroundColor: profitInfo.isPositive ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)' },
              ]}>
                <Text style={styles.profitIndicatorLabel}>Profit per item</Text>
                <Text style={[
                  styles.profitIndicatorValue,
                  { color: profitInfo.isPositive ? '#10b981' : '#ef4444' },
                ]}>
                  {profitInfo.isPositive ? '+' : ''}Rs. {profitInfo.profit.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Image Upload */}
            <View>
              <Text style={styles.fieldLabel}>Image</Text>
              <TouchableOpacity
                style={styles.imageUploadArea}
                onPress={handlePickImage}
                activeOpacity={0.7}
                disabled={imageUploading}
              >
                {imageUploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : resolvedImageUri ? (
                  <View style={styles.imagePreviewWrap}>
                    <Image source={{ uri: resolvedImageUri }} style={styles.imagePreview} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.imageRemoveBtn}
                      onPress={() => setImageUrl('')}
                    >
                      <Icon name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imageUploadPlaceholder}>
                    <Icon name="cloud-upload-outline" size={28} color={colors.primary} />
                    <Text style={styles.imageUploadText}>Click to upload or drag and drop</Text>
                    <Text style={styles.imageUploadHint}>PNG, JPG or WEBP (max 5MB)</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Category */}
            <View>
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={{ zIndex: 100 }}>
                <TouchableOpacity
                  style={styles.fieldInput}
                  onPress={() => setShowCatDropdown(!showCatDropdown)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownTrigger}>
                    <Text style={[
                      styles.dropdownTriggerText,
                      !category && { color: colors.mutedForeground },
                    ]}>
                      {category || 'Select category'}
                    </Text>
                    <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>

                {showCatDropdown && (
                  <View style={styles.formDropdownMenu}>
                    <ScrollView style={styles.formDropdownScroll} nestedScrollEnabled>
                      <TouchableOpacity
                        style={[styles.dropdownItem, !category && styles.dropdownItemActive]}
                        onPress={() => { setCategory(''); setCategoryId(''); setShowCatDropdown(false); }}
                      >
                        <Text style={[styles.dropdownItemText, !category && styles.dropdownItemTextActive]}>
                          No category
                        </Text>
                      </TouchableOpacity>
                      {displayCategories.map(cat => (
                        <TouchableOpacity
                          key={cat.id || cat.name}
                          style={[styles.dropdownItem, category === cat.name && styles.dropdownItemActive]}
                          onPress={() => handleSelectCategory(cat)}
                        >
                          <Text style={[styles.dropdownItemText, category === cat.name && styles.dropdownItemTextActive]}>
                            {cat.name}{cat.isReadyServe ? ' \u26A1' : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              <TextInput
                style={[styles.fieldInput, { marginTop: 8 }]}
                value={customCategory}
                onChangeText={setCustomCategory}
                placeholder="Or type a new category"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Preparation Time */}
            <View>
              <Text style={styles.fieldLabel}>Preparation Time (min)</Text>
              <TextInput
                style={[styles.fieldInput, isInstant && { opacity: 0.5 }]}
                value={preparationTime}
                onChangeText={setPreparationTime}
                placeholder="e.g., 15"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                editable={!isInstant}
              />
            </View>

            {/* Toggles row — matching web layout */}
            <View style={styles.togglesRow}>
              {/* Ready to Serve */}
              <TouchableOpacity
                style={styles.toggleRowItem}
                onPress={() => setIsInstant(!isInstant)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.togglePill,
                  isInstant ? styles.togglePillActiveAmber : styles.togglePillInactive,
                ]}>
                  <View style={[
                    styles.toggleDot,
                    isInstant ? styles.toggleDotActive : styles.toggleDotInactive,
                  ]}>
                    <Icon name="flash" size={12} color={isInstant ? '#f59e0b' : colors.mutedForeground} />
                  </View>
                </View>
                <Text style={styles.toggleLabel}>Ready to Serve</Text>
              </TouchableOpacity>

              {/* Vegetarian */}
              <TouchableOpacity
                style={styles.toggleRowItem}
                onPress={() => setIsVeg(!isVeg)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.togglePill,
                  isVeg ? styles.togglePillActiveGreen : styles.togglePillInactive,
                ]}>
                  <View style={[
                    styles.toggleDot,
                    isVeg ? styles.toggleDotActive : styles.toggleDotInactive,
                  ]}>
                    <Icon name="leaf" size={12} color={isVeg ? '#22c55e' : colors.mutedForeground} />
                  </View>
                </View>
                <Text style={styles.toggleLabel}>Vegetarian</Text>
              </TouchableOpacity>

              {/* Available */}
              <TouchableOpacity
                style={styles.toggleRowItem}
                onPress={() => setIsAvailable(!isAvailable)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.togglePill,
                  isAvailable ? styles.togglePillActiveBlue : styles.togglePillInactive,
                ]}>
                  <View style={[
                    styles.toggleDot,
                    isAvailable ? styles.toggleDotActive : styles.toggleDotInactive,
                  ]}>
                    {isAvailable ? (
                      <Icon name="checkmark" size={12} color="#3b82f6" />
                    ) : (
                      <Icon name="close" size={12} color={colors.mutedForeground} />
                    )}
                  </View>
                </View>
                <Text style={styles.toggleLabel}>Available</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
              <Icon name="checkmark" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>{item ? 'Update' : 'Add Item'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header section above FlatList (so dropdown renders on top of items)
  headerSection: { zIndex: 10, backgroundColor: colors.background },

  // Top header row
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  itemCount: { fontSize: 14, color: colors.mutedForeground },
  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.primary,
  },
  addItemText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Categories collapsible
  categoriesBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  categoriesBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoriesBarText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  categoriesBarCount: { fontSize: 12, color: colors.mutedForeground },
  categoriesExpanded: {
    marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8, gap: 6,
  },
  categoryItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  categoryItemName: { fontSize: 13, color: colors.foreground },
  categoryItemCount: { fontSize: 12, color: colors.mutedForeground },

  // Search + Category Dropdown
  filterRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8, zIndex: 50,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: colors.border, height: 42,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.foreground, padding: 0 },
  categoryDropdownWrap: { zIndex: 50 },
  categoryDropdown: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, height: 42, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  categoryDropdownText: { fontSize: 13, color: colors.foreground, maxWidth: 100 },
  dropdownMenu: {
    position: 'absolute', top: 46, right: 0, minWidth: 170, maxHeight: 260, zIndex: 999,
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 4, elevation: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  dropdownItemActive: { backgroundColor: 'rgba(59,130,246,0.1)' },
  dropdownItemText: { fontSize: 13, color: colors.foreground },
  dropdownItemTextActive: { color: '#3b82f6', fontWeight: '600' },

  // Item card
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
    marginHorizontal: 16,
  },
  cardUnavailable: { opacity: 0.5 },
  cardImageWrap: { position: 'relative' },
  cardImage: { width: 56, height: 56, borderRadius: 12 },
  cardImagePlaceholder: {
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center',
  },
  vegBadge: {
    position: 'absolute', top: -4, left: -4,
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#22c55e',
    justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.foreground, flexShrink: 1 },
  itemCategory: { fontSize: 12, color: colors.mutedForeground },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  priceText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  offerPriceInline: { fontSize: 12, fontWeight: '600', color: '#f59e0b' },
  profitInline: { fontSize: 11, fontWeight: '600' },
  prepTime: { fontSize: 11, color: colors.mutedForeground },

  // Card actions
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.muted,
  },
  // Pill-shaped availability toggle (matching web: w-12 h-7 rounded-full)
  cardToggleSwitch: {
    width: 48, height: 28, borderRadius: 14,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  cardToggleSwitchOn: { backgroundColor: '#3b82f6' },
  cardToggleSwitchOff: { backgroundColor: colors.muted },
  cardToggleDot: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  cardToggleDotOn: {
    backgroundColor: '#fff', alignSelf: 'flex-end',
  },
  cardToggleDotOff: {
    backgroundColor: colors.card, alignSelf: 'flex-start',
  },

  // Empty state
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 14, color: colors.mutedForeground, marginTop: 12, marginBottom: 16 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
  },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Modal Overlay
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  // Offer modal
  offerModalContent: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24,
  },
  offerTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground, marginBottom: 4 },
  offerSub: { fontSize: 13, color: colors.mutedForeground, marginBottom: 16 },
  offerInput: {
    backgroundColor: colors.muted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.foreground, marginBottom: 16,
  },
  offerActions: { flexDirection: 'row', gap: 10 },
  offerCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  offerCancelText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
  offerSubmit: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#f59e0b', alignItems: 'center',
  },
  offerSubmitText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Form modal (redesigned)
  formModal: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, maxHeight: '92%',
  },
  formHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  formTitle: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  formCloseBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.muted,
    justifyContent: 'center', alignItems: 'center',
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground, marginBottom: 6 },
  fieldInput: {
    backgroundColor: colors.muted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.foreground, borderWidth: 1, borderColor: colors.border,
  },
  fieldInputMultiline: { height: 70, textAlignVertical: 'top' },

  // Profit indicator
  profitIndicator: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  profitIndicatorLabel: { fontSize: 13, color: colors.mutedForeground },
  profitIndicatorValue: { fontSize: 13, fontWeight: '700' },

  // Image upload
  imageUploadArea: {
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: 14, minHeight: 120, justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  imageUploadPlaceholder: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  imageUploadText: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  imageUploadHint: { fontSize: 11, color: colors.mutedForeground },
  imagePreviewWrap: { width: '100%', position: 'relative' },
  imagePreview: { width: '100%', height: 180, borderRadius: 12 },
  imageRemoveBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12,
  },

  // Dropdown in form modal
  dropdownTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownTriggerText: { fontSize: 14, color: colors.foreground },
  formDropdownMenu: {
    position: 'absolute', top: 50, left: 0, right: 0, zIndex: 100,
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    elevation: 8, maxHeight: 200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  formDropdownScroll: { maxHeight: 200 },

  // Custom toggles (matching web)
  togglesRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  toggleRowItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  togglePill: {
    width: 44, height: 26, borderRadius: 13, justifyContent: 'center',
  },
  togglePillInactive: { backgroundColor: colors.muted },
  togglePillActiveAmber: { backgroundColor: '#f59e0b' },
  togglePillActiveGreen: { backgroundColor: '#22c55e' },
  togglePillActiveBlue: { backgroundColor: '#3b82f6' },
  toggleDot: {
    width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center',
  },
  toggleDotInactive: {
    backgroundColor: colors.card, marginLeft: 2,
  },
  toggleDotActive: {
    backgroundColor: '#fff', alignSelf: 'flex-end', marginRight: 2,
  },
  toggleLabel: { fontSize: 14, color: colors.foreground },

  // Form action buttons
  formActions: {
    flexDirection: 'row', gap: 12, paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.muted, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  saveBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Misc
  flex1: { flex: 1 },
  scrollContent: { paddingTop: 4, paddingBottom: 20 },
  loaderMargin: { marginTop: 60 },
  bottomSpacer: { height: 100 },
  formScrollContent: { gap: 14, paddingBottom: 20 },
  formPriceRow: { flexDirection: 'row', gap: 12 },
});
