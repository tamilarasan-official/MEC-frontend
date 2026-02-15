import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../theme/colors';
import { SuperAdminUser, Shop } from '../../types';
import * as saService from '../../services/superadminService';
import ScreenWrapper from '../../components/common/ScreenWrapper';

const ROLES = ['superadmin', 'accountant', 'owner', 'captain', 'student'];
const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIDS', 'AIML', 'Other'];
const ROLE_COLORS: Record<string, string> = {
  superadmin: '#ef4444', accountant: '#8b5cf6', owner: '#f59e0b', captain: '#3b82f6', student: '#10b981',
};

export default function SAUsersScreen() {
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState('captain');
  const [createShopId, setCreateShopId] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await saService.getUsers({ search, role: roleFilter, page, limit: 50 });
      setUsers(res.users);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, roleFilter, page]);

  const fetchShops = useCallback(async () => {
    try { setShops(await saService.getShops()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchShops(); }, [fetchShops]);

  const onRefresh = () => { setRefreshing(true); fetchUsers(); };

  const handleToggleActive = async (u: SuperAdminUser) => {
    try {
      if (u.isActive) { await saService.deactivateUser(u.id); }
      else { await saService.reactivateUser(u.id); }
      fetchUsers();
    } catch { Alert.alert('Error', 'Failed to update user status'); }
  };

  const handleToggleAdhoc = async (u: SuperAdminUser) => {
    try {
      await saService.toggleAdhocPrivilege(u.id);
      fetchUsers();
    } catch { Alert.alert('Error', 'Failed to toggle adhoc privilege'); }
  };

  const handleCreate = async () => {
    if (!createName.trim() || !createUsername.trim() || createPassword.length < 8) {
      Alert.alert('Error', 'Name, username required, password min 8 chars');
      return;
    }
    setCreating(true);
    try {
      await saService.createUser({
        name: createName, username: createUsername, password: createPassword,
        role: createRole, shopId: createShopId || undefined,
      });
      setShowCreate(false);
      setCreateName(''); setCreateUsername(''); setCreatePassword('');
      fetchUsers();
      Alert.alert('Success', 'User created');
    } catch {
      Alert.alert('Error', 'Failed to create user');
    } finally { setCreating(false); }
  };

  const renderUser = ({ item: u }: { item: SuperAdminUser }) => (
    <View style={styles.userCard}>
      <View style={styles.userTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{u.name?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{u.name}</Text>
          <Text style={styles.userDetail}>{u.username || u.email}</Text>
          {u.rollNumber ? <Text style={styles.userDetail}>{u.rollNumber} • {u.department}</Text> : null}
        </View>
        <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLORS[u.role] || '#888') + '20' }]}>
          <Text style={[styles.roleText, { color: ROLE_COLORS[u.role] || '#888' }]}>{u.role}</Text>
        </View>
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionBtn, !u.isActive && styles.actionBtnDanger]}
          onPress={() => handleToggleActive(u)}
        >
          <Icon name={u.isActive ? 'person-remove-outline' : 'person-add-outline'} size={16} color={u.isActive ? colors.danger : '#10b981'} />
          <Text style={[styles.actionText, { color: u.isActive ? colors.danger : '#10b981' }]}>
            {u.isActive ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
        {u.role !== 'student' && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleAdhoc(u)}>
            <Icon name="card-outline" size={16} color="#6366f1" />
            <Text style={[styles.actionText, { color: '#6366f1' }]}>Adhoc</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Users ({total})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Icon name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add Staff</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={t => { setSearch(t); setPage(1); }}
            placeholder="Search users..."
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <ScrollableFilter roleFilter={roleFilter} setRoleFilter={(r: string) => { setRoleFilter(r); setPage(1); }} />

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={<Text style={styles.empty}>No users found</Text>}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity disabled={page <= 1} onPress={() => setPage(p => p - 1)}>
                  <Text style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}>← Prev</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>{page} / {totalPages}</Text>
                <TouchableOpacity disabled={page >= totalPages} onPress={() => setPage(p => p + 1)}>
                  <Text style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}>Next →</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* Create User Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Staff Member</Text>
            <TextInput style={styles.modalInput} placeholder="Name *" value={createName} onChangeText={setCreateName} placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.modalInput} placeholder="Username *" value={createUsername} onChangeText={setCreateUsername} autoCapitalize="none" placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.modalInput} placeholder="Password (min 8) *" value={createPassword} onChangeText={setCreatePassword} secureTextEntry placeholderTextColor={colors.textMuted} />
            <View style={styles.roleRow}>
              {['captain', 'owner'].map(r => (
                <TouchableOpacity key={r} style={[styles.roleChip, createRole === r && styles.roleChipActive]} onPress={() => setCreateRole(r)}>
                  <Text style={[styles.roleChipText, createRole === r && styles.roleChipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {shops.length > 0 && (
              <View style={styles.shopSelect}>
                <Text style={styles.fieldLabel}>Assign to Shop</Text>
                <ScrollableShops shops={shops} selected={createShopId} onSelect={setCreateShopId} />
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </ScreenWrapper>
  );
}

function ScrollableFilter({ roleFilter, setRoleFilter }: { roleFilter: string; setRoleFilter: (r: string) => void }) {
  return (
    <View style={styles.filterRow}>
      <TouchableOpacity
        style={[styles.filterChip, !roleFilter && styles.filterChipActive]}
        onPress={() => setRoleFilter('')}
      >
        <Text style={[styles.filterText, !roleFilter && styles.filterTextActive]}>All</Text>
      </TouchableOpacity>
      {ROLES.map(r => (
        <TouchableOpacity key={r} style={[styles.filterChip, roleFilter === r && styles.filterChipActive]} onPress={() => setRoleFilter(r)}>
          <Text style={[styles.filterText, roleFilter === r && styles.filterTextActive]}>{r}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ScrollableShops({ shops, selected, onSelect }: { shops: Shop[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <FlatList
      data={shops}
      horizontal
      keyExtractor={s => s.id}
      showsHorizontalScrollIndicator={false}
      renderItem={({ item: s }) => (
        <TouchableOpacity style={[styles.shopChip, selected === s.id && styles.shopChipActive]} onPress={() => onSelect(s.id)}>
          <Text style={[styles.shopChipText, selected === s.id && styles.shopChipTextActive]}>{s.name}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 4 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  searchRow: { paddingHorizontal: 20, marginBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, paddingVertical: 10, marginLeft: 8, fontSize: 14, color: colors.text },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 6, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  userCard: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  userTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: '700', color: colors.text },
  userDetail: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  userActions: { flexDirection: 'row', marginTop: 10, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.background },
  actionBtnDanger: {},
  actionText: { fontSize: 12, fontWeight: '600' },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingVertical: 16 },
  pageBtn: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  pageBtnDisabled: { color: colors.textMuted },
  pageInfo: { color: colors.textMuted, fontSize: 14 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: colors.card, borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, backgroundColor: colors.background, marginBottom: 10 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  roleChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  roleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleChipText: { color: colors.textMuted, fontWeight: '600', textTransform: 'capitalize' },
  roleChipTextActive: { color: '#fff' },
  shopSelect: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  shopChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginRight: 8, backgroundColor: colors.background },
  shopChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  shopChipText: { fontSize: 13, color: colors.textMuted },
  shopChipTextActive: { color: '#fff', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  submitBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700' },
});
