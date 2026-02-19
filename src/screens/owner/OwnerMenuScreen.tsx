import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Switch, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import {
  fetchOwnerMenu, createMenuItem, updateMenuItem, deleteMenuItem,
  toggleItemAvailability, setItemOffer, removeItemOffer,
} from '../../store/slices/menuSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { FoodItem } from '../../types';
import { CATEGORIES } from '../../constants';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type ViewMode = 'grid' | 'list';

export default function OwnerMenuScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const ownerMenuItems = useSelector((s: RootState) => s.menu.ownerMenuItems);
  const isLoading = useSelector((s: RootState) => s.menu.isLoading);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [_viewMode, _setViewMode] = useState<ViewMode>('list');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [offerModal, setOfferModal] = useState<FoodItem | null>(null);
  const [offerPrice, setOfferPrice] = useState('');

  const loadMenu = useCallback(async () => {
    await dispatch(fetchOwnerMenu());
  }, [dispatch]);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  const onRefresh = async () => { setRefreshing(true); await loadMenu(); setRefreshing(false); };

  // Filter
  let filtered = ownerMenuItems;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }
  if (categoryFilter) {
    filtered = filtered.filter(i => i.category === categoryFilter);
  }

  const categories = [...new Set(ownerMenuItems.map(i => i.category))];
  const availableCount = ownerMenuItems.filter(i => i.isAvailable).length;
  const offersCount = ownerMenuItems.filter(i => i.isOffer).length;

  const handleToggleAvailability = (item: FoodItem) => {
    dispatch(toggleItemAvailability({ itemId: item.id, isAvailable: !item.isAvailable }));
  };

  const handleDelete = (item: FoodItem) => {
    Alert.alert('Delete Item', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => dispatch(deleteMenuItem(item.id)) },
    ]);
  };

  const handleOfferSubmit = () => {
    if (!offerModal) return;
    const price = parseFloat(offerPrice);
    if (!price || price <= 0 || price >= offerModal.price) {
      Alert.alert('Invalid', 'Offer price must be less than regular price.');
      return;
    }
    dispatch(setItemOffer({ itemId: offerModal.id, offerPrice: price }));
    setOfferModal(null);
    setOfferPrice('');
  };

  const handleRemoveOffer = (item: FoodItem) => {
    dispatch(removeItemOffer(item.id));
  };

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{ownerMenuItems.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{availableCount}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statValue, { color: colors.orange[500] }]}>{offersCount}</Text>
          <Text style={styles.statLabel}>Offers</Text>
        </View>
      </View>

      {/* Search + Actions */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingItem(null); setShowAddModal(true); }}>
          <Icon name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        <TouchableOpacity
          style={[styles.catChip, !categoryFilter && styles.catChipActive]}
          onPress={() => setCategoryFilter(null)}
        >
          <Text style={[styles.catChipText, !categoryFilter && styles.catChipTextActive]}>All</Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catChip, categoryFilter === cat && styles.catChipActive]}
            onPress={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
          >
            <Text style={[styles.catChipText, categoryFilter === cat && styles.catChipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items List */}
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isLoading && filtered.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loaderMargin} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="restaurant-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No menu items found</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => { setEditingItem(null); setShowAddModal(true); }}>
              <Icon name="add" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Add First Item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map(item => (
            <MenuItemCard
              key={item.id}
              item={item}
              onToggle={handleToggleAvailability}
              onEdit={(it) => { setEditingItem(it); setShowAddModal(true); }}
              onDelete={handleDelete}
              onOffer={(it) => { setOfferModal(it); setOfferPrice(it.offerPrice?.toString() || ''); }}
              onRemoveOffer={handleRemoveOffer}
            />
          ))
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add/Edit Modal */}
      <AddEditModal
        visible={showAddModal}
        item={editingItem}
        onClose={() => { setShowAddModal(false); setEditingItem(null); }}
        onSave={(data) => {
          if (editingItem) {
            dispatch(updateMenuItem({ itemId: editingItem.id, data }));
          } else {
            dispatch(createMenuItem(data));
          }
          setShowAddModal(false);
          setEditingItem(null);
        }}
      />

      {/* Offer Price Modal */}
      <Modal visible={!!offerModal} transparent animationType="fade" onRequestClose={() => setOfferModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.offerModalContent}>
            <Text style={styles.offerTitle}>Set Offer Price</Text>
            <Text style={styles.offerSub}>
              Regular price: Rs.{offerModal?.price}
            </Text>
            <TextInput
              style={styles.offerInput}
              placeholder="Enter offer price"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={offerPrice}
              onChangeText={setOfferPrice}
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
    </ScreenWrapper>
  );
}

/* ----------- Menu Item Card ----------- */
function MenuItemCard({
  item, onToggle, onEdit, onDelete, onOffer, onRemoveOffer,
}: {
  item: FoodItem;
  onToggle: (i: FoodItem) => void;
  onEdit: (i: FoodItem) => void;
  onDelete: (i: FoodItem) => void;
  onOffer: (i: FoodItem) => void;
  onRemoveOffer: (i: FoodItem) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.card, !item.isAvailable && styles.cardUnavailable]}>
      <View style={styles.cardTop}>
        {/* Food icon & name */}
        <View style={styles.cardInfo}>
          <View style={[styles.vegBadge, item.isVeg ? styles.vegBadgeBgVeg : styles.vegBadgeBgNonVeg]}>
            <View style={[styles.vegDot, { backgroundColor: item.isVeg ? colors.primary : colors.destructive }]} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemCategory}>{item.category}</Text>
          </View>
        </View>

        {/* Price */}
        <View style={styles.priceContainer}>
          {item.isOffer && item.offerPrice ? (
            <>
              <Text style={styles.originalPrice}>Rs.{item.price}</Text>
              <Text style={styles.offerPriceText}>Rs.{item.offerPrice}</Text>
            </>
          ) : (
            <Text style={styles.priceText}>Rs.{item.price}</Text>
          )}
        </View>
      </View>

      {item.description ? (
        <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
      ) : null}

      {/* Bottom actions */}
      <View style={styles.cardActions}>
        <View style={styles.availRow}>
          <Text style={styles.availLabel}>{item.isAvailable ? 'Available' : 'Unavailable'}</Text>
          <Switch
            value={item.isAvailable}
            onValueChange={() => onToggle(item)}
            trackColor={{ false: colors.destructive, true: colors.primary }}
            thumbColor="#fff"
            style={{ transform: [{ scale: 0.8 }] }}
          />
        </View>

        <View style={styles.btnGroup}>
          {item.isOffer ? (
            <TouchableOpacity style={styles.iconBtn} onPress={() => onRemoveOffer(item)}>
              <Icon name="pricetag" size={16} color={colors.orange[500]} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.iconBtn} onPress={() => onOffer(item)}>
              <Icon name="pricetag-outline" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => onEdit(item)}>
            <Icon name="create-outline" size={16} color={colors.blue[500]} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => onDelete(item)}>
            <Icon name="trash-outline" size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ----------- Add/Edit Modal ----------- */
function AddEditModal({
  visible, item, onClose, onSave,
}: {
  visible: boolean;
  item: FoodItem | null;
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
  const [preparationTime, setPreparationTime] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [isInstant, setIsInstant] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description || '');
      setPrice(item.price.toString());
      setCostPrice(item.costPrice?.toString() || '');
      setCategory(item.category || '');
      setPreparationTime(item.preparationTime || '');
      setIsVeg(item.isVeg ?? true);
      setIsInstant(item.isInstant ?? false);
    } else {
      setName(''); setDescription(''); setPrice(''); setCostPrice('');
      setCategory(''); setPreparationTime(''); setIsVeg(true); setIsInstant(false);
    }
  }, [item, visible]);

  const handleSubmit = () => {
    if (!name.trim() || !price.trim() || !category.trim()) {
      Alert.alert('Required', 'Name, price and category are required.');
      return;
    }
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) { Alert.alert('Invalid', 'Enter a valid price.'); return; }

    onSave({
      name: name.trim(),
      description: description.trim(),
      price: p,
      costPrice: costPrice ? parseFloat(costPrice) : undefined,
      category: category.trim(),
      preparationTime: preparationTime.trim() || undefined,
      isVeg,
      isInstant,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.formModal}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{item ? 'Edit Item' : 'Add New Item'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.flex1} contentContainerStyle={styles.formScrollContent}>
            <View>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput style={styles.fieldInput} value={name} onChangeText={setName} placeholder="Item name" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput style={[styles.fieldInput, styles.fieldInputMultiline]} value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={colors.mutedForeground} multiline />
            </View>
            <View style={styles.priceRow}>
              <View style={styles.flex1}>
                <Text style={styles.fieldLabel}>Price *</Text>
                <TextInput style={styles.fieldInput} value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.fieldLabel}>Cost Price</Text>
                <TextInput style={styles.fieldInput} value={costPrice} onChangeText={setCostPrice} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </View>
            </View>
            <View>
              <Text style={styles.fieldLabel}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScrollContent}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, category === cat && styles.catChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputSpaced]}
                value={category}
                onChangeText={setCategory}
                placeholder="Or type custom category"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Preparation Time</Text>
              <TextInput style={styles.fieldInput} value={preparationTime} onChangeText={setPreparationTime} placeholder="e.g. 10 mins" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Vegetarian</Text>
              <Switch value={isVeg} onValueChange={setIsVeg} trackColor={{ false: colors.destructive, true: colors.primary }} thumbColor="#fff" />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Instant (no prep needed)</Text>
              <Switch value={isInstant} onValueChange={setIsInstant} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor="#fff" />
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
            <Text style={styles.saveBtnText}>{item ? 'Update Item' : 'Add Item'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  statsRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  statChip: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  statLabel: { fontSize: 10, color: colors.mutedForeground, marginTop: 2 },
  searchRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 4,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: colors.border, height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.foreground },
  addBtn: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  categoryRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
  catChipTextActive: { color: '#fff' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 14, color: colors.mutedForeground, marginTop: 12, marginBottom: 16 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
  },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  cardUnavailable: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  vegBadge: {
    width: 20, height: 20, borderRadius: 4, justifyContent: 'center', alignItems: 'center',
  },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  itemCategory: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  priceText: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  originalPrice: {
    fontSize: 12, color: colors.mutedForeground, textDecorationLine: 'line-through',
  },
  offerPriceText: { fontSize: 16, fontWeight: '800', color: colors.orange[500] },
  itemDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 6 },
  cardActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  availRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  availLabel: { fontSize: 12, color: colors.mutedForeground },
  btnGroup: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: colors.muted,
    justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
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
    backgroundColor: colors.orange[500], alignItems: 'center',
  },
  offerSubmitText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  formModal: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, maxHeight: '90%',
  },
  formHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  formTitle: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground, marginBottom: 6 },
  fieldInput: {
    backgroundColor: colors.muted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.foreground,
  },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.muted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  switchLabel: { fontSize: 14, color: colors.foreground },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 10, marginBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  flex1: { flex: 1 },
  scrollContent: { padding: 16 },
  loaderMargin: { marginTop: 60 },
  bottomSpacer: { height: 100 },
  vegBadgeBgVeg: { backgroundColor: 'rgba(16,185,129,0.15)' },
  vegBadgeBgNonVeg: { backgroundColor: 'rgba(239,68,68,0.15)' },
  priceContainer: { alignItems: 'flex-end' },
  formScrollContent: { gap: 14, paddingBottom: 20 },
  fieldInputMultiline: { height: 70, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', gap: 12 },
  catScrollContent: { gap: 6 },
  fieldInputSpaced: { marginTop: 8 },
});
