import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../theme/colors';
import { Shop, ShopCategory } from '../../types';
import * as saService from '../../services/superadminService';
import ScreenWrapper from '../../components/common/ScreenWrapper';

const CATEGORIES: { key: ShopCategory; icon: string; label: string }[] = [
  { key: 'canteen', icon: 'restaurant-outline', label: 'Canteen' },
  { key: 'laundry', icon: 'shirt-outline', label: 'Laundry' },
  { key: 'stationery', icon: 'print-outline', label: 'Stationery' },
  { key: 'other', icon: 'grid-outline', label: 'Other' },
];

export default function SAShopsScreen() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editShop, setEditShop] = useState<Shop | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<ShopCategory>('canteen');
  const [formPhone, setFormPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchShops = useCallback(async () => {
    try { setShops(await saService.getShops()); }
    catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  const onRefresh = () => { setRefreshing(true); fetchShops(); };

  const openCreate = () => {
    setEditShop(null);
    setFormName(''); setFormDesc(''); setFormCategory('canteen'); setFormPhone('');
    setOwnerName(''); setOwnerEmail(''); setOwnerPassword('');
    setShowModal(true);
  };

  const openEdit = (shop: Shop) => {
    setEditShop(shop);
    setFormName(shop.name); setFormDesc(shop.description || ''); setFormCategory(shop.category); setFormPhone('');
    setOwnerName(''); setOwnerEmail(''); setOwnerPassword('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setSaving(true);
    try {
      if (editShop) {
        await saService.updateShop(editShop.id, { name: formName, description: formDesc, category: formCategory });
      } else {
        await saService.createShop({
          name: formName, description: formDesc, category: formCategory, contactPhone: formPhone,
          ownerDetails: ownerName ? { name: ownerName, email: ownerEmail, password: ownerPassword } : undefined,
        });
      }
      setShowModal(false);
      fetchShops();
    } catch { Alert.alert('Error', 'Failed to save shop'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (shop: Shop) => {
    try { await saService.toggleShopStatus(shop.id); fetchShops(); }
    catch { Alert.alert('Error', 'Failed to toggle status'); }
  };

  const handleDelete = (shop: Shop) => {
    Alert.alert('Delete Shop', `Are you sure you want to delete "${shop.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await saService.deleteShop(shop.id); fetchShops(); }
        catch { Alert.alert('Error', 'Failed to delete shop'); }
      }},
    ]);
  };

  const getCategoryIcon = (cat: ShopCategory) => CATEGORIES.find(c => c.key === cat)?.icon || 'grid-outline';

  const renderShop = ({ item: shop }: { item: Shop }) => (
    <View style={styles.shopCard}>
      <View style={styles.shopHeader}>
        <View style={styles.shopIcon}>
          <Icon name={getCategoryIcon(shop.category)} size={24} color={colors.primary} />
        </View>
        <View style={styles.shopInfo}>
          <Text style={styles.shopName}>{shop.name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: shop.isActive ? '#10b98120' : '#ef444420' }]}>
              <Text style={[styles.statusText, { color: shop.isActive ? '#10b981' : '#ef4444' }]}>
                {shop.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <View style={styles.catBadge}>
              <Text style={styles.catText}>{shop.category}</Text>
            </View>
          </View>
        </View>
      </View>
      {shop.description ? <Text style={styles.shopDesc}>{shop.description}</Text> : null}
      <View style={styles.shopActions}>
        <TouchableOpacity style={styles.shopBtn} onPress={() => openEdit(shop)}>
          <Icon name="create-outline" size={16} color={colors.primary} />
          <Text style={[styles.shopBtnText, { color: colors.primary }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shopBtn} onPress={() => handleToggle(shop)}>
          <Icon name={shop.isActive ? 'pause-outline' : 'play-outline'} size={16} color="#f59e0b" />
          <Text style={[styles.shopBtnText, { color: '#f59e0b' }]}>{shop.isActive ? 'Disable' : 'Enable'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shopBtn} onPress={() => handleDelete(shop)}>
          <Icon name="trash-outline" size={16} color={colors.danger} />
          <Text style={[styles.shopBtnText, { color: colors.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Shops ({shops.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Icon name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add Shop</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={shops}
          keyExtractor={s => s.id}
          renderItem={renderShop}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={<Text style={styles.empty}>No shops found</Text>}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editShop ? 'Edit Shop' : 'Create Shop'}</Text>
            <TextInput style={styles.input} placeholder="Shop Name *" value={formName} onChangeText={setFormName} placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} placeholder="Description" value={formDesc} onChangeText={setFormDesc} multiline placeholderTextColor={colors.textMuted} />
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c.key} style={[styles.catChip, formCategory === c.key && styles.catChipActive]} onPress={() => setFormCategory(c.key)}>
                  <Icon name={c.icon} size={18} color={formCategory === c.key ? '#fff' : colors.textMuted} />
                  <Text style={[styles.catChipText, formCategory === c.key && styles.catChipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!editShop && (
              <>
                <Text style={styles.fieldLabel}>Owner (optional)</Text>
                <TextInput style={styles.input} placeholder="Owner Name" value={ownerName} onChangeText={setOwnerName} placeholderTextColor={colors.textMuted} />
                <TextInput style={styles.input} placeholder="Owner Email" value={ownerEmail} onChangeText={setOwnerEmail} autoCapitalize="none" placeholderTextColor={colors.textMuted} />
                <TextInput style={styles.input} placeholder="Owner Password" value={ownerPassword} onChangeText={setOwnerPassword} secureTextEntry placeholderTextColor={colors.textMuted} />
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>{editShop ? 'Update' : 'Create'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 4 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  shopCard: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  shopHeader: { flexDirection: 'row', alignItems: 'center' },
  shopIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  shopInfo: { flex: 1, marginLeft: 12 },
  shopName: { fontSize: 16, fontWeight: '700', color: colors.text },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.border },
  catText: { fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' },
  shopDesc: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  shopActions: { flexDirection: 'row', marginTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  shopBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.background },
  shopBtnText: { fontSize: 12, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.card, borderRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, backgroundColor: colors.background, marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginTop: 4 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: 13, color: colors.textMuted },
  catChipTextActive: { color: '#fff', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  submitBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700' },
});
