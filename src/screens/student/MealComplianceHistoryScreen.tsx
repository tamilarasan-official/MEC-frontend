import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StudentHomeStackParamList } from '../../types';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import mealComplianceService, { MealComplianceHistoryRecord } from '../../services/mealComplianceService';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'MealComplianceHistory'>;

function formatLabel(record: MealComplianceHistoryRecord): string {
  const amount = record.debitAmount ?? record.officialAmountSnapshot;
  if (record.status === 'refunded') return `Refunded Rs.${amount}`;
  if (record.status === 'exempted') return `Exempted Rs.${amount}`;
  if (record.status === 'leave_exempted') return `Leave protected Rs.${amount}`;
  return `Debited Rs.${amount}`;
}

export default function MealComplianceHistoryScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<MealComplianceHistoryRecord[]>([]);

  const load = useCallback(async () => {
    const history = await mealComplianceService.getHistory();
    setRecords(history);
  }, []);

  useFocusEffect(useCallback(() => {
    load().catch(() => undefined);
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => undefined);
    setRefreshing(false);
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meal Compliance History</Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="calendar-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No missed meal records yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.cardTitle}>{item.sessionType[0].toUpperCase() + item.sessionType.slice(1)}</Text>
                  <Text style={styles.cardDate}>{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </View>
                <Text style={[
                  styles.badge,
                  item.status === 'debited' && styles.badgeDebit,
                  item.status === 'refunded' && styles.badgeRefund,
                  item.status === 'exempted' && styles.badgeExempt,
                  item.status === 'leave_exempted' && styles.badgeExempt,
                ]}>
                  {item.status}
                </Text>
              </View>
              <Text style={styles.amount}>{formatLabel(item)}</Text>
              <Text style={styles.foodName}>{item.officialFoodNameSnapshot}</Text>
              {item.exemptReason ? <Text style={styles.reason}>{item.exemptReason}</Text> : null}
            </View>
          )}
        />
      </View>
    </ScreenWrapper>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  headerSpacer: { width: 36 },
  listContent: { padding: 16, paddingBottom: 40, gap: 10 },
  card: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: c.text },
  cardDate: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  badge: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  badgeDebit: { backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  badgeRefund: { backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981' },
  badgeExempt: { backgroundColor: 'rgba(245,158,11,0.12)', color: '#d97706' },
  amount: { marginTop: 12, fontSize: 16, fontWeight: '800', color: c.text },
  foodName: { marginTop: 6, fontSize: 13, color: c.textSecondary },
  reason: { marginTop: 8, fontSize: 12, color: c.textMuted },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText: { color: c.textSecondary, fontSize: 14 },
});
