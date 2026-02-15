import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../theme/colors';
import { PaymentRequest } from '../../types';
import * as saService from '../../services/superadminService';
import ScreenWrapper from '../../components/common/ScreenWrapper';

const STATUS_COLORS: Record<string, string> = { active: '#10b981', closed: '#6366f1', cancelled: '#ef4444' };
const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIDS', 'AIML'];

export default function SAPaymentsScreen() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formTargetType, setFormTargetType] = useState<'all' | 'department' | 'year'>('all');
  const [formDept, setFormDept] = useState('');
  const [formYear, setFormYear] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await saService.getPaymentRequests({ status: statusFilter, page, limit: 10 });
      setRequests(res.requests);
      setTotalPages(res.pagination.totalPages);
    } catch { /* ignore */ } finally { setLoading(false); setRefreshing(false); }
  }, [statusFilter, page]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const onRefresh = () => { setRefreshing(true); fetchRequests(); };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formAmount || !formDueDate) {
      Alert.alert('Error', 'Title, amount, and due date are required');
      return;
    }
    setCreating(true);
    try {
      await saService.createPaymentRequest({
        title: formTitle, description: formDesc, amount: Number(formAmount),
        dueDate: formDueDate, targetType: formTargetType,
        targetDepartment: formTargetType === 'department' ? formDept : undefined,
        targetYear: formTargetType === 'year' ? Number(formYear) : undefined,
      });
      setShowCreate(false);
      setFormTitle(''); setFormDesc(''); setFormAmount(''); setFormDueDate('');
      fetchRequests();
      Alert.alert('Success', 'Payment request created');
    } catch { Alert.alert('Error', 'Failed to create payment request'); }
    finally { setCreating(false); }
  };

  const handleClose = (req: PaymentRequest, status: 'closed' | 'cancelled') => {
    Alert.alert(
      status === 'closed' ? 'Close Request' : 'Cancel Request',
      `Are you sure you want to ${status === 'closed' ? 'close' : 'cancel'} "${req.title}"?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: async () => {
          try { await saService.closePaymentRequest(req.id, status); fetchRequests(); }
          catch { Alert.alert('Error', 'Failed to update request'); }
        }},
      ],
    );
  };

  const handleRemind = async (req: PaymentRequest) => {
    try {
      await saService.sendPaymentReminders(req.id);
      Alert.alert('Success', 'Reminders sent');
    } catch { Alert.alert('Error', 'Failed to send reminders'); }
  };

  const renderRequest = ({ item: req }: { item: PaymentRequest }) => {
    const pct = req.totalCount > 0 ? Math.round((req.paidCount / req.totalCount) * 100) : 0;
    const statusColor = STATUS_COLORS[req.status] || '#888';
    return (
      <View style={styles.reqCard}>
        <View style={styles.reqHeader}>
          <Text style={styles.reqTitle}>{req.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{req.status}</Text>
          </View>
        </View>
        {req.description ? <Text style={styles.reqDesc}>{req.description}</Text> : null}
        <View style={styles.reqStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Amount</Text>
            <Text style={styles.statValue}>₹{req.amount}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Paid</Text>
            <Text style={styles.statValue}>{req.paidCount}/{req.totalCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Collected</Text>
            <Text style={styles.statValue}>₹{req.totalCollected}</Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressText}>{pct}% collected</Text>
        {req.status === 'active' && (
          <View style={styles.reqActions}>
            <TouchableOpacity style={styles.reqBtn} onPress={() => handleRemind(req)}>
              <Icon name="notifications-outline" size={14} color={colors.primary} />
              <Text style={[styles.reqBtnText, { color: colors.primary }]}>Remind</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reqBtn} onPress={() => handleClose(req, 'closed')}>
              <Icon name="checkmark-circle-outline" size={14} color="#10b981" />
              <Text style={[styles.reqBtnText, { color: '#10b981' }]}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reqBtn} onPress={() => handleClose(req, 'cancelled')}>
              <Icon name="close-circle-outline" size={14} color={colors.danger} />
              <Text style={[styles.reqBtnText, { color: colors.danger }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Payment Requests</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Icon name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {['active', 'closed', 'cancelled'].map(s => (
          <TouchableOpacity key={s} style={[styles.filterChip, statusFilter === s && styles.filterActive]} onPress={() => { setStatusFilter(s); setPage(1); }}>
            <Text style={[styles.filterText, statusFilter === s && styles.filterTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={r => r.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={<Text style={styles.empty}>No payment requests</Text>}
        />
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Payment Request</Text>
            <TextInput style={styles.input} placeholder="Title *" value={formTitle} onChangeText={setFormTitle} placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} placeholder="Description" value={formDesc} onChangeText={setFormDesc} multiline placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} placeholder="Amount *" value={formAmount} onChangeText={setFormAmount} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} placeholder="Due Date (YYYY-MM-DD) *" value={formDueDate} onChangeText={setFormDueDate} placeholderTextColor={colors.textMuted} />
            <Text style={styles.fieldLabel}>Target</Text>
            <View style={styles.targetRow}>
              {(['all', 'department', 'year'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.targetChip, formTargetType === t && styles.targetActive]} onPress={() => setFormTargetType(t)}>
                  <Text style={[styles.targetText, formTargetType === t && styles.targetTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {formTargetType === 'department' && (
              <View style={styles.deptRow}>
                {DEPARTMENTS.map(d => (
                  <TouchableOpacity key={d} style={[styles.deptChip, formDept === d && styles.deptActive]} onPress={() => setFormDept(d)}>
                    <Text style={[styles.deptText, formDept === d && styles.deptTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {formTargetType === 'year' && (
              <View style={styles.deptRow}>
                {['1', '2', '3', '4'].map(y => (
                  <TouchableOpacity key={y} style={[styles.deptChip, formYear === y && styles.deptActive]} onPress={() => setFormYear(y)}>
                    <Text style={[styles.deptText, formYear === y && styles.deptTextActive]}>Year {y}</Text>
                  </TouchableOpacity>
                ))}
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
          </ScrollView>
        </View>
      </Modal>
    </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 4 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10, gap: 6 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, color: colors.textMuted, textTransform: 'capitalize' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  reqCard: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reqTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  reqDesc: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  reqStats: { flexDirection: 'row', marginTop: 12, gap: 12 },
  statItem: { flex: 1 },
  statLabel: { fontSize: 11, color: colors.textMuted },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: 12 },
  progressFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  progressText: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  reqActions: { flexDirection: 'row', marginTop: 10, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  reqBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.background },
  reqBtnText: { fontSize: 12, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalScroll: { maxHeight: '85%', backgroundColor: colors.card, borderRadius: 20 },
  modalContent: { padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, backgroundColor: colors.background, marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  targetRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  targetChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  targetActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  targetText: { color: colors.textMuted, fontWeight: '600', textTransform: 'capitalize' },
  targetTextActive: { color: '#fff' },
  deptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  deptChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  deptActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  deptText: { fontSize: 12, color: colors.textMuted },
  deptTextActive: { color: '#fff', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  submitBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700' },
});
