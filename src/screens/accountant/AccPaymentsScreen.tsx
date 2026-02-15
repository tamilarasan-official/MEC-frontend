import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../theme/colors';
import { User } from '../../types';
import * as accountantService from '../../services/accountantService';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type OpType = 'credit' | 'debit';
const SOURCES = ['cash', 'online', 'complementary', 'pg'];

export default function AccPaymentsScreen({ route }: any) {
  const preSelectedId = route?.params?.studentId;
  const [students, setStudents] = useState<User[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [opType, setOpType] = useState<OpType>('credit');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('cash');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchModal, setSearchModal] = useState(false);
  const [search, setSearch] = useState('');

  const loadStudents = useCallback(async () => {
    try {
      const data = await accountantService.getStudents();
      setStudents(data);
      if (preSelectedId) {
        const found = data.find(s => s.id === preSelectedId);
        if (found) setSelectedStudent(found);
      }
    } catch { } finally { setLoading(false); }
  }, [preSelectedId]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const handleSubmit = async () => {
    if (!selectedStudent) return Alert.alert('Error', 'Select a student first');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return Alert.alert('Error', 'Enter a valid amount');
    if (opType === 'debit' && !description.trim()) return Alert.alert('Error', 'Description is required for debit');

    try {
      setSubmitting(true);
      if (opType === 'credit') {
        await accountantService.creditWallet(selectedStudent.id, amt, source, description || undefined);
      } else {
        await accountantService.debitWallet(selectedStudent.id, amt, description.trim());
      }
      Alert.alert('Success', `₹${amt} ${opType === 'credit' ? 'credited to' : 'debited from'} ${selectedStudent.name}'s wallet`);
      setAmount('');
      setDescription('');
      // Refresh student data
      const updated = await accountantService.getStudents();
      setStudents(updated);
      const refreshed = updated.find(s => s.id === selectedStudent.id);
      if (refreshed) setSelectedStudent(refreshed);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Operation failed');
    } finally { setSubmitting(false); }
  };

  const filteredStudents = students.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.username?.toLowerCase().includes(search.toLowerCase()) ||
    s.rollNumber?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></ScreenWrapper>;

  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Wallet Operations</Text>

      {/* Student Selector */}
      <Text style={styles.label}>Student</Text>
      <TouchableOpacity style={styles.selectBtn} onPress={() => setSearchModal(true)}>
        {selectedStudent ? (
          <View style={styles.selectedRow}>
            <View style={styles.miniAvatar}>
              <Text style={styles.miniAvatarText}>{selectedStudent.name.charAt(0)}</Text>
            </View>
            <View>
              <Text style={styles.selectedName}>{selectedStudent.name}</Text>
              <Text style={styles.selectedDetail}>{selectedStudent.rollNumber} • Balance: ₹{selectedStudent.balance ?? 0}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.selectPlaceholder}>Tap to select student</Text>
        )}
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Operation Type */}
      <Text style={styles.label}>Operation</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity style={[styles.typeBtn, opType === 'credit' && styles.typeCreditActive]}
          onPress={() => setOpType('credit')}>
          <Icon name="arrow-down-circle" size={20} color={opType === 'credit' ? '#fff' : '#16a34a'} />
          <Text style={[styles.typeText, opType === 'credit' && styles.typeTextActive]}>Credit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.typeBtn, opType === 'debit' && styles.typeDebitActive]}
          onPress={() => setOpType('debit')}>
          <Icon name="arrow-up-circle" size={20} color={opType === 'debit' ? '#fff' : '#ef4444'} />
          <Text style={[styles.typeText, opType === 'debit' && styles.typeTextActive]}>Debit</Text>
        </TouchableOpacity>
      </View>

      {/* Amount */}
      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount}
        keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textMuted} />

      {/* Source (credit only) */}
      {opType === 'credit' && (
        <>
          <Text style={styles.label}>Source</Text>
          <View style={styles.sourceRow}>
            {SOURCES.map(s => (
              <TouchableOpacity key={s} style={[styles.sourceChip, source === s && styles.sourceActive]}
                onPress={() => setSource(s)}>
                <Text style={[styles.sourceText, source === s && styles.sourceTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Description */}
      <Text style={styles.label}>Description (optional)</Text>
      <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
        value={description} onChangeText={setDescription}
        placeholder="Add a note..." placeholderTextColor={colors.textMuted} multiline />

      <TouchableOpacity style={[styles.submitBtn, { backgroundColor: opType === 'credit' ? '#16a34a' : '#ef4444' }]}
        onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : (
          <>
            <Icon name={opType === 'credit' ? 'arrow-down-circle' : 'arrow-up-circle'} size={20} color="#fff" />
            <Text style={styles.submitText}>{opType === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Student Search Modal */}
      <Modal visible={searchModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Student</Text>
              <TouchableOpacity onPress={() => { setSearchModal(false); setSearch(''); }}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearch}>
              <Icon name="search-outline" size={18} color={colors.textMuted} />
              <TextInput style={styles.modalSearchInput} placeholder="Search students..."
                placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} autoFocus />
            </View>

            <FlatList data={filteredStudents} keyExtractor={s => s.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.studentOption} onPress={() => {
                  setSelectedStudent(item);
                  setSearchModal(false);
                  setSearch('');
                }}>
                  <View style={styles.miniAvatar}>
                    <Text style={styles.miniAvatarText}>{item.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionName}>{item.name}</Text>
                    <Text style={styles.optionDetail}>{item.rollNumber || item.username} • ₹{item.balance ?? 0}</Text>
                  </View>
                </TouchableOpacity>
              )} />
          </View>
        </View>
      </Modal>
    </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 16 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  miniAvatarText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  selectedName: { fontSize: 15, fontWeight: '600', color: colors.text },
  selectedDetail: { fontSize: 12, color: colors.textMuted },
  selectPlaceholder: { fontSize: 14, color: colors.textMuted },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  typeCreditActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  typeDebitActive: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  typeText: { fontSize: 15, fontWeight: '600', color: colors.text },
  typeTextActive: { color: '#fff' },
  input: { backgroundColor: colors.card, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sourceChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sourceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sourceText: { fontSize: 13, color: colors.textMuted },
  sourceTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 16, marginTop: 24 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, gap: 8, marginBottom: 12 },
  modalSearchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  studentOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionName: { fontSize: 15, fontWeight: '600', color: colors.text },
  optionDetail: { fontSize: 12, color: colors.textMuted },
});
