import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchQRPayments } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';

// ── Helpers ──
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

type QuickFilter = 'today' | 'week' | 'month' | 'all' | 'date';
const QUICK_FILTERS: { key: QuickFilter; label: string; icon: string }[] = [
  { key: 'today', label: 'Today', icon: 'today-outline' },
  { key: 'week', label: 'This Week', icon: 'calendar-outline' },
  { key: 'month', label: 'This Month', icon: 'calendar-number-outline' },
  { key: 'all', label: 'All', icon: 'infinite-outline' },
];

interface TxItem {
  id: string;
  title: string;
  description: string;
  studentName: string;
  studentRollNumber?: string;
  amount: number;
  paidAt: string;
}

function matchesFilter(dateStr: string, filter: QuickFilter, selectedDate: Date): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  switch (filter) {
    case 'today':
      return sameDay(d, now);
    case 'week': {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    }
    case 'month':
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    case 'date':
      return sameDay(d, selectedDate);
    case 'all':
    default:
      return true;
  }
}

export default function StationeryHistoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const qrPayments = useAppSelector(s => s.user.qrPayments);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<QuickFilter>('today');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calMonth, setCalMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => { dispatch(fetchQRPayments()); }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchQRPayments());
    setRefreshing(false);
  }, [dispatch]);

  // Flatten payers into transaction list
  const allTx = useMemo((): TxItem[] => {
    const items: TxItem[] = [];
    for (const p of qrPayments) {
      for (const payer of (p.payers || [])) {
        items.push({
          id: `${p.id}-${payer.studentName}-${payer.paidAt}`,
          title: p.title,
          description: p.description || '',
          studentName: payer.studentName,
          studentRollNumber: payer.studentRollNumber,
          amount: payer.amount,
          paidAt: payer.paidAt,
        });
      }
    }
    return items.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  }, [qrPayments]);

  const filteredTx = useMemo(() =>
    allTx.filter(t => matchesFilter(t.paidAt, filter, selectedDate)),
  [allTx, filter, selectedDate]);

  const totalAmount = filteredTx.reduce((s, t) => s + t.amount, 0);

  // Calendar data
  const txDateSet = useMemo(() => {
    const set = new Set<string>();
    for (const t of allTx) {
      const d = new Date(t.paidAt);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return set;
  }, [allTx]);

  const cYear = calMonth.getFullYear();
  const cMonth = calMonth.getMonth();
  const calDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < getFirstDay(cYear, cMonth); i++) days.push(null);
    for (let i = 1; i <= getDaysInMonth(cYear, cMonth); i++) days.push(i);
    return days;
  }, [cYear, cMonth]);

  const handleDayPress = (day: number) => {
    setSelectedDate(new Date(cYear, cMonth, day));
    setFilter('date');
    setShowCalendar(false);
  };

  const handleFilterPress = (key: QuickFilter) => {
    setFilter(key);
    if (key !== 'date') setShowCalendar(false);
  };

  const getFilterLabel = () => {
    if (filter === 'date') return selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return QUICK_FILTERS.find(f => f.key === filter)?.label || '';
  };

  const renderTx = ({ item }: { item: TxItem }) => (
    <View style={styles.txCard}>
      <View style={styles.txIcon}>
        <Icon name="document-text-outline" size={18} color="#10b981" />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txTitle} numberOfLines={1}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <Text style={styles.txSub}>
          {item.studentName}{item.studentRollNumber ? ` · ${item.studentRollNumber}` : ''}
        </Text>
        <Text style={styles.txTime}>
          {new Date(item.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {new Date(item.paidAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </Text>
      </View>
      <Text style={styles.txAmt}>+Rs.{item.amount}</Text>
    </View>
  );

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Payment History</Text>
            <Text style={styles.headerSub}>{getFilterLabel()} · {filteredTx.length} transactions</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowCalendar(!showCalendar)}
            style={[styles.calBtn, showCalendar && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
          >
            <Icon name="calendar-outline" size={20} color={showCalendar ? colors.accent : colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Quick Filter Tabs */}
        <View style={styles.filterRow}>
          {QUICK_FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => handleFilterPress(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
          {filter === 'date' && (
            <View style={[styles.filterTab, styles.filterTabActive]}>
              <Text style={[styles.filterTabText, styles.filterTabTextActive]}>
                {selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          )}
        </View>

        {/* Calendar (collapsible) */}
        {showCalendar && (
          <View style={styles.calendar}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={() => setCalMonth(new Date(cYear, cMonth - 1, 1))} style={styles.calNavBtn}>
                <Icon name="chevron-back" size={18} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={styles.calMonthLabel}>{MONTH_NAMES[cMonth]} {cYear}</Text>
              <TouchableOpacity
                onPress={() => {
                  const now = new Date();
                  if (cYear < now.getFullYear() || (cYear === now.getFullYear() && cMonth < now.getMonth()))
                    setCalMonth(new Date(cYear, cMonth + 1, 1));
                }}
                style={styles.calNavBtn}
              >
                <Icon name="chevron-forward" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.calDayLabels}>
              {DAY_LABELS.map(d => <Text key={d} style={styles.calDayLabel}>{d}</Text>)}
            </View>

            <View style={styles.calGrid}>
              {calDays.map((day, i) => {
                if (day === null) return <View key={`e-${i}`} style={styles.calCell} />;
                const cellDate = new Date(cYear, cMonth, day);
                const isToday = sameDay(cellDate, new Date());
                const isSelected = filter === 'date' && sameDay(cellDate, selectedDate);
                const hasTx = txDateSet.has(`${cYear}-${cMonth}-${day}`);
                const isFuture = cellDate > new Date();
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.calCell, isSelected && styles.calCellSelected]}
                    onPress={() => !isFuture && handleDayPress(day)}
                    disabled={isFuture}
                    activeOpacity={0.7}
                  >
                    {isToday && !isSelected ? (
                      <View style={styles.todayWrap}>
                        <Icon name="document-text" size={10} color={colors.accent} />
                        <Text style={[styles.calDayText, styles.calDayToday]}>{day}</Text>
                      </View>
                    ) : (
                      <Text style={[
                        styles.calDayText,
                        isSelected && styles.calDaySelected,
                        isFuture && { opacity: 0.3 },
                      ]}>{day}</Text>
                    )}
                    {hasTx && !isSelected && <View style={styles.calDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryLeft}>
            <Icon name="cash-outline" size={16} color="#10b981" />
            <Text style={styles.summaryAmt}>Rs. {totalAmount}</Text>
          </View>
          <Text style={styles.summaryCount}>{filteredTx.length} payment{filteredTx.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* Transaction List */}
        <FlatList
          data={filteredTx}
          keyExtractor={item => item.id}
          renderItem={renderTx}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Icon name="document-text-outline" size={36} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No transactions</Text>
              <Text style={styles.emptySub}>No payments received for this period</Text>
            </View>
          }
        />
      </View>
    </ScreenWrapper>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  calBtn: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
  },

  // Quick filters
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10,
  },
  filterTab: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
    marginRight: 6,
  },
  filterTabActive: { backgroundColor: c.accent, borderColor: c.accent },
  filterTabText: { fontSize: 11, fontWeight: '600', color: c.mutedForeground },
  filterTabTextActive: { color: '#fff' },

  // Calendar
  calendar: {
    marginHorizontal: 16, backgroundColor: c.card,
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border,
    marginBottom: 8,
  },
  calHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  calNavBtn: { padding: 6, borderRadius: 10, backgroundColor: c.background },
  calMonthLabel: { fontSize: 15, fontWeight: '700', color: c.foreground },
  calDayLabels: { flexDirection: 'row', marginBottom: 6 },
  calDayLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', color: c.mutedForeground },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.28%', height: 40, justifyContent: 'center', alignItems: 'center',
  },
  calCellSelected: { backgroundColor: c.accent, borderRadius: 18 },
  calDayText: { fontSize: 13, fontWeight: '500', color: c.foreground },
  calDaySelected: { color: '#fff', fontWeight: '700' },
  calDayToday: { color: c.accent, fontWeight: '700', fontSize: 11 },
  todayWrap: { alignItems: 'center' },
  calDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: c.accent,
    position: 'absolute', bottom: 3,
  },

  // Summary
  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 10,
  },
  summaryLeft: { flexDirection: 'row', alignItems: 'center' },
  summaryAmt: { fontSize: 14, fontWeight: '800', color: '#10b981', marginLeft: 6 },
  summaryCount: { fontSize: 11, color: c.mutedForeground },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: c.border, marginBottom: 8,
  },
  txIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.12)', justifyContent: 'center', alignItems: 'center',
  },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '600', color: c.foreground },
  txDesc: { fontSize: 11, color: c.mutedForeground, marginTop: 1, fontStyle: 'italic' },
  txSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  txTime: { fontSize: 11, color: c.mutedForeground, marginTop: 2 },
  txAmt: { fontSize: 15, fontWeight: '700', color: '#10b981' },

  empty: { alignItems: 'center', paddingTop: 50, gap: 8 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: c.card,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    borderWidth: 1, borderColor: c.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: c.foreground },
  emptySub: { fontSize: 13, color: c.mutedForeground },
});
