import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { MonthlySummary, LeaderboardPreview, WeeklyChallenge, WeeklyChallengeDay } from '../../types';
import Icon from '../common/Icon';

interface Props {
  summary: MonthlySummary | null;
  leaderboard: LeaderboardPreview | null;
  weeklyChallenge: WeeklyChallenge | null;
  month: number;
  year: number;
  onPress: () => void;
  onGiftBoxPress: () => void;
}

function getPersonalityIcon(type: string): string {
  switch (type) {
    case 'coffee_addict': return 'cafe-outline';
    case 'biriyani_boss': return 'restaurant-outline';
    case 'snack_monster': return 'fast-food-outline';
    case 'meal_planner': return 'calendar-outline';
    case 'healthy_eater': return 'leaf-outline';
    case 'night_owl': return 'moon-outline';
    case 'early_bird': return 'sunny-outline';
    case 'big_spender': return 'card-outline';
    case 'loyal_regular': return 'heart-outline';
    case 'weekend_warrior': return 'rocket-outline';
    default: return 'sparkles-outline';
  }
}

function getDaySquareColor(day: WeeklyChallengeDay, completedDays: number): string {
  if (day.isFuture) return 'rgba(255,255,255,0.12)';   // future — very faint
  if (!day.completed) return 'rgba(255,255,255,0.22)';  // past missed — visible but muted
  // Completed days glow brighter as week progresses
  if (completedDays <= 3) return '#a78bfa';   // early week — light purple
  if (completedDays <= 5) return '#7c3aed';   // mid week — deep purple
  return '#fbbf24';                            // 6-7 days — gold!
}

function getGiftState(completedDays: number, claimed: boolean): { tint: string; glow: string; opacity: number } {
  if (claimed) return { tint: '#fbbf24', glow: 'rgba(251,191,36,0.45)', opacity: 1 };
  if (completedDays === 0) return { tint: 'rgba(255,255,255,0.5)', glow: 'transparent', opacity: 0.4 };
  if (completedDays <= 2) return { tint: '#c4b5fd', glow: 'transparent', opacity: 0.7 };
  if (completedDays <= 4) return { tint: '#a78bfa', glow: 'rgba(167,139,250,0.3)', opacity: 0.85 };
  if (completedDays <= 6) return { tint: '#8b5cf6', glow: 'rgba(139,92,246,0.4)', opacity: 1 };
  return { tint: '#fbbf24', glow: 'rgba(251,191,36,0.55)', opacity: 1 };
}

// Fallback weekly days when no data loaded yet
const EMPTY_DAYS: WeeklyChallengeDay[] = Array.from({ length: 7 }, (_, i) => ({
  date: '',
  dayLabel: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][i],
  orderCount: 0,
  completed: false,
  isFuture: true,
}));

function StreakChatCard({ summary, leaderboard, weeklyChallenge, month, year, onPress, onGiftBoxPress }: Props) {
  const streak = summary?.currentStreak ?? 0;
  const personality = summary?.personality;
  const userRank = leaderboard?.userRank;

  const completedDays = weeklyChallenge?.completedDays ?? 0;
  const isClaimable = weeklyChallenge?.isClaimable ?? false;
  const claimed = weeklyChallenge?.claimed ?? false;
  const days = weeklyChallenge?.days ?? EMPTY_DAYS;
  const gift = getGiftState(completedDays, claimed);

  // Pulse animation when gift is claimable
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isClaimable) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.25, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1.00, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, isClaimable]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel="Open streak">
      <LinearGradient
        colors={['#4c1d95', '#7c3aed']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.card}>

        {/* Left: flame + streak */}
        <View style={styles.streakBlock}>
          <Icon name="flame" size={20} color="#fff" />
          <Text style={styles.streakNum}>{streak}</Text>
          <Text style={styles.streakLabel}>DAYS</Text>
        </View>

        {/* Center: 7-day weekly progress */}
        <View style={styles.weekBlock}>
          <View style={styles.weekRow}>
            {days.map((day, i) => (
              <View key={i} style={styles.dayCol}>
                <Text style={styles.dayLabel}>{day.dayLabel}</Text>
                <View style={[styles.daySquare, { backgroundColor: getDaySquareColor(day, completedDays) }]}>
                  {day.completed && <Text style={styles.dayCheck}>✓</Text>}
                </View>
              </View>
            ))}
          </View>
          {/* Personality row */}
          <View style={styles.personalityRow}>
            {personality && (
              <View style={styles.personalityBadge}>
                <Icon name={getPersonalityIcon(personality.type)} size={11} color="#fff" />
                <Text style={styles.personalityText}>{personality.label}</Text>
              </View>
            )}
            {userRank != null && (
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{userRank}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right: gift box */}
        <TouchableOpacity
          style={styles.giftBtn}
          onPress={() => onGiftBoxPress()}
          activeOpacity={0.75}
          accessibilityLabel={isClaimable ? 'Claim weekly badge' : 'Weekly challenge progress'}
          accessibilityRole="button">
          <Animated.View style={[
            styles.giftGlow,
            { backgroundColor: gift.glow, transform: [{ scale: pulseAnim }] },
          ]} />
          <Icon name="gift-outline" size={24} color={gift.tint} style={{ opacity: gift.opacity }} />
          {completedDays > 0 && (
            <Text style={styles.giftCount}>{completedDays}/7</Text>
          )}
        </TouchableOpacity>

        {/* Chevron */}
        <Icon name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default React.memo(StreakChatCard);

const styles = StyleSheet.create({
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
    gap: 8,
  },
  streakBlock: { alignItems: 'center', minWidth: 42 },
  streakNum: { fontSize: 22, fontWeight: '900', color: '#fff', lineHeight: 26 },
  streakLabel: { fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 0.5 },
  weekBlock: { flex: 1, gap: 6 },
  weekRow: { flexDirection: 'row', gap: 3, justifyContent: 'center' },
  dayCol: { alignItems: 'center', gap: 3 },
  dayLabel: { fontSize: 8, color: 'rgba(255,255,255,0.65)', fontWeight: '700' },
  daySquare: {
    width: 20, height: 20, borderRadius: 5,
    justifyContent: 'center', alignItems: 'center',
  },
  dayCheck: { fontSize: 10, color: '#fff', fontWeight: '900' },
  personalityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  personalityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  personalityText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  rankBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1,
  },
  rankText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  giftBtn: {
    width: 38, alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  giftGlow: {
    position: 'absolute', width: 38, height: 38, borderRadius: 19,
  },
  giftCount: {
    fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.9)',
  },
});
