import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { User } from '../../types';
import * as accountantService from '../../services/accountantService';
import ScreenWrapper from '../../components/common/ScreenWrapper';

const DEPARTMENTS = ['All', 'CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIDS', 'AIML'];

export default function AccStudentsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [students, setStudents] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStudents = useCallback(async () => {
    try {
      const data = await accountantService.getStudents();
      setStudents(data);
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const filtered = students.filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.username?.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber?.toLowerCase().includes(search.toLowerCase());
    const matchDept = department === 'All' || s.department === department;
    return matchSearch && matchDept;
  });

  const totalBalance = filtered.reduce((sum, s) => sum + (s.balance || 0), 0);

  const renderStudent = ({ item }: { item: User }) => (
    <TouchableOpacity style={styles.studentCard}
      onPress={() => navigation.navigate('Payments', { studentId: item.id })}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.name}</Text>
        <Text style={styles.studentDetail}>{item.rollNumber || item.username} • {item.department || 'N/A'}</Text>
        {item.phone && <Text style={styles.studentDetail}>📱 {item.phone}</Text>}
      </View>
      <View style={styles.balanceBox}>
        <Text style={[styles.balance, (item.balance || 0) >= 0 ? styles.balancePositive : styles.balanceNegative]}>
          ₹{(item.balance || 0).toLocaleString()}
        </Text>
        <Text style={styles.balanceLabel}>Balance</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></ScreenWrapper>;

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Students</Text>
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>{filtered.length} students</Text>
          <Text style={styles.statsText}>Total: ₹{totalBalance.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Icon name="search-outline" size={18} color={colors.textMuted} />
        <TextInput style={styles.searchInput} placeholder="Search by name, reg no..." placeholderTextColor={colors.textMuted}
          value={search} onChangeText={setSearch} />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList horizontal data={DEPARTMENTS} showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.deptRow}
        keyExtractor={d => d}
        renderItem={({ item: d }) => (
          <TouchableOpacity style={[styles.deptChip, department === d && styles.deptActive]} onPress={() => setDepartment(d)}>
            <Text style={[styles.deptText, department === d && styles.deptTextActive]}>{d}</Text>
          </TouchableOpacity>
        )} />

      <FlatList data={filtered} keyExtractor={s => s.id}
        renderItem={renderStudent}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStudents(); }} colors={[colors.primary]} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No students found</Text>} />
    </View>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 50 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 12 },
  statsText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, marginHorizontal: 20, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  deptRow: { paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  deptChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  deptActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  deptText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  deptTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  studentInfo: { flex: 1, marginLeft: 12 },
  studentName: { fontSize: 15, fontWeight: '600', color: colors.text },
  studentDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  balanceBox: { alignItems: 'flex-end' },
  balance: { fontSize: 16, fontWeight: '800' },
  balanceLabel: { fontSize: 10, color: colors.textMuted },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },
  balancePositive: { color: '#16a34a' },
  balanceNegative: { color: '#ef4444' },
});
