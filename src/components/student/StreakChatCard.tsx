import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { MonthlySummary, LeaderboardPreview } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import HeatmapGrid from './HeatmapGrid';

interface Props {
  summary: MonthlySummary | null;
  leaderboard: LeaderboardPreview | null;
  month: number;
  year: number;
  onPress: () => void;
}

export default function StreakChatCard({ summary, leaderboard, month, year, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const streak = summary?.currentStreak ?? 0;
  const personality = summary?.personality;
  const userRank = leaderboard?.userRank;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel="Open streak">
      <LinearGradient
        colors={['#4c1d95', '#7c3aed']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.card}>
        {/* Left: flame + streak */}
        <View style={styles.streakBlock}>
          <Text style={styles.flame}>🔥</Text>
          <Text style={styles.streakNum}>{streak}</Text>
          <Text style={styles.streakLabel}>day{streak !== 1 ? 's' : ''}</Text>
        </View>

        {/* Center: mini heatmap dots */}
        <View style={styles.heatmapBlock}>
          {summary ? (
            <HeatmapGrid
              heatmap={summary.heatmap}
              month={month}
              year={year}
              compact
              cardMode
            />
          ) : (
            <Text style={styles.emptyHeat}>Tap to view your food activity</Text>
          )}
        </View>

        {/* Right: personality + rank */}
        <View style={styles.rightBlock}>
          {personality && (
            <Text style={styles.personalityRow}>
              {personality.emoji} {personality.label}
            </Text>
          )}
          {userRank != null && (
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{userRank}</Text>
            </View>
          )}
        </View>

        {/* Chevron */}
        <Text style={styles.chevron}>›</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 8,
      gap: 10,
    },
    streakBlock: { alignItems: 'center', minWidth: 44 },
    flame: { fontSize: 20 },
    streakNum: { fontSize: 22, fontWeight: '900', color: '#fff', lineHeight: 26 },
    streakLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    heatmapBlock: { flex: 1, alignItems: 'center' },
    emptyHeat: { fontSize: 11, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
    rightBlock: { alignItems: 'flex-end', gap: 4 },
    personalityRow: { fontSize: 11, color: '#fff', fontWeight: '700', textAlign: 'right' },
    rankBadge: {
      backgroundColor: 'rgba(255,255,255,0.25)',
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    rankText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    chevron: { fontSize: 22, color: 'rgba(255,255,255,0.7)', lineHeight: 24 },
  });
}
