import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { HeatmapDay } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

interface Props {
  heatmap: HeatmapDay[];
  month: number;
  year: number;
  compact?: boolean; // true → show only last 14 days as dots
  cardMode?: boolean; // compact dots rendered on a colored card — use white-based palette
  onDayPress?: (day: HeatmapDay) => void;
}

function getCellColor(day: HeatmapDay, isDark: boolean, cardMode: boolean): string {
  if (cardMode) {
    if (day.orderCount === 0) return 'rgba(255,255,255,0.18)';
    if (day.isPerfect) return '#fbbf24';
    if (day.orderCount >= 3) return 'rgba(255,255,255,0.95)';
    if (day.orderCount === 2) return 'rgba(255,255,255,0.7)';
    return 'rgba(255,255,255,0.45)';
  }
  if (day.orderCount === 0) return isDark ? '#2a2a3e' : '#ede9fe';
  if (day.isPerfect) return '#fbbf24';
  if (day.orderCount >= 3) return '#6d28d9';
  if (day.orderCount === 2) return '#8b5cf6';
  return '#c4b5fd';
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function HeatmapGrid({ heatmap, month, year, compact, cardMode = false, onDayPress }: Props) {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (compact) {
    // Last 14 days as small dots
    const last14 = heatmap.slice(-14);
    return (
      <View style={styles.compactRow}>
        {last14.map(day => (
          <View
            key={day.date}
            style={[
              styles.compactDot,
              { backgroundColor: getCellColor(day, isDark, cardMode) },
              day.isPerfect && styles.compactDotPerfect,
            ]}
          />
        ))}
      </View>
    );
  }

  // Full month grid — figure out what day of week the 1st falls on
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const totalCells = firstDayOfWeek + heatmap.length;
  const rows = Math.ceil(totalCells / 7);

  const cells: (HeatmapDay | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...heatmap,
  ];

  return (
    <View style={styles.grid}>
      {/* Day-of-week header */}
      <View style={styles.dayLabelsRow}>
        {DAY_LABELS.map((l, i) => (
          <View key={i} style={styles.dayLabelCell}>
            <Text style={styles.dayLabel}>{l}</Text>
          </View>
        ))}
      </View>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <View key={rowIdx} style={styles.gridRow}>
          {Array.from({ length: 7 }).map((_, colIdx) => {
            const cell = cells[rowIdx * 7 + colIdx];
            if (!cell) return <View key={colIdx} style={styles.emptyCell} />;
            const today = new Date();
            const cellDate = new Date(cell.date);
            const isToday =
              cellDate.getDate() === today.getDate() &&
              cellDate.getMonth() === today.getMonth() &&
              cellDate.getFullYear() === today.getFullYear();

            return (
              <TouchableOpacity
                key={colIdx}
                style={[
                  styles.cell,
                  { backgroundColor: getCellColor(cell, isDark, false) },
                  isToday && styles.cellToday,
                  cell.isPerfect && styles.cellPerfect,
                ]}
                onPress={() => onDayPress?.(cell)}
                activeOpacity={0.7}
                accessibilityLabel={`${cell.date}: ${cell.orderCount} orders`}>
                <Text style={[
                  styles.cellText,
                  cell.orderCount > 0 && styles.cellTextActive,
                ]}>
                  {cellDate.getDate()}
                </Text>
                {cell.isPerfect && <Text style={styles.starOverlay}>★</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Less</Text>
        {(['#ede9fe', '#c4b5fd', '#8b5cf6', '#6d28d9', '#fbbf24'] as const).map(c => (
          <View key={c} style={[styles.legendDot, { backgroundColor: c }]} />
        ))}
        <Text style={styles.legendLabel}>More</Text>
        <View style={[styles.legendDot, { backgroundColor: '#fbbf24', marginLeft: 8 }]} />
        <Text style={styles.legendLabel}>Perfect day ★</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    grid: { paddingHorizontal: 4 },
    dayLabelsRow: { flexDirection: 'row', marginBottom: 4 },
    dayLabelCell: { flex: 1, alignItems: 'center' },
    dayLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
    gridRow: { flexDirection: 'row', marginBottom: 4 },
    emptyCell: { flex: 1, height: 32, marginHorizontal: 2 },
    cell: {
      flex: 1,
      height: 32,
      marginHorizontal: 2,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellToday: { borderWidth: 2, borderColor: '#3b82f6' },
    cellPerfect: { borderWidth: 1.5, borderColor: '#f59e0b' },
    cellText: { fontSize: 9, color: '#6b7280', fontWeight: '500' },
    cellTextActive: { color: '#1f2937', fontWeight: '700' },
    starOverlay: { position: 'absolute', top: -2, right: 1, fontSize: 8, color: '#92400e' },
    legend: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 4 },
    legendDot: { width: 12, height: 12, borderRadius: 3 },
    legendLabel: { fontSize: 10, color: colors.textMuted, marginHorizontal: 2 },
    // Compact
    compactRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    compactDot: { width: 10, height: 10, borderRadius: 3 },
    compactDotPerfect: { borderWidth: 1, borderColor: '#f59e0b' },
  });
}
