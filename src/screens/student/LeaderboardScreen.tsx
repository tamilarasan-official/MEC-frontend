import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image, InteractionManager,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, LeaderboardEntry } from '../../types';
import walletService from '../../services/walletService';
import { resolveImageUrl } from '../../utils/imageUrl';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import CachedImage from '../../components/common/CachedImage';
import { LeaderboardSkeleton } from '../../components/common/SkeletonLoader';
import { useAppSelector } from '../../store';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Leaderboard'>;

export default function LeaderboardScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAppSelector(s => s.auth.user);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const data = await walletService.getLeaderboard();
      setEntries(data);
      setError(null);
    } catch (err) {
      setError('Something went wrong. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchData();
    });
    return () => task.cancel();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const podiumColors = ['#eab308', '#94a3b8', '#d97706']; // Gold, Silver, Bronze
  const currentUserEntry = useMemo(() => {
    if (!user?.id) return null;
    const match = entries.find(entry => entry.userId === user.id);
    if (!match) return null;
    return {
      ...match,
      rank: match.rank ?? entries.findIndex(entry => entry.userId === user.id) + 1,
    };
  }, [entries, user?.id]);

  const Avatar = ({ entry, size, textStyle, imageStyle }: {
    entry: LeaderboardEntry;
    size: number;
    textStyle: any;
    imageStyle: any;
  }) => {
    const imageUrl = resolveImageUrl(entry.avatarUrl);
    return imageUrl ? (
      <CachedImage uri={imageUrl} style={imageStyle} accessibilityLabel={`${entry.userName} profile avatar`} />
    ) : (
      <Text style={textStyle}>{entry.userName?.charAt(0)?.toUpperCase() || '?'}</Text>
    );
  };

  if (loading) {
    return <ScreenWrapper><LeaderboardSkeleton /></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Podium */}
      {entries.length >= 3 && (
        <View style={styles.podium}>
          {[1, 0, 2].map(idx => {
            const e = entries[idx];
            const isFirst = idx === 0;
            return (
              <View key={e.userId} style={[styles.podiumSpot, isFirst && styles.podiumFirst]}>
                <View style={[styles.podiumAvatar, { borderColor: podiumColors[idx] }]}>
                  <Avatar entry={e} size={56} textStyle={styles.podiumAvatarText} imageStyle={styles.podiumAvatarImg} />
                </View>
                <Text style={styles.podiumName} numberOfLines={1}>{e.userName}</Text>
                <Text style={[styles.podiumRank, { color: podiumColors[idx] }]}>#{idx + 1}</Text>
                <Text style={styles.podiumSpent}>Rs.{e.totalSpent}</Text>
              </View>
            );
          })}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {currentUserEntry && (
          <View style={styles.currentUserCard}>
            <View style={styles.currentUserHeader}>
              <Text style={styles.currentUserLabel}>Your Place</Text>
              <Text style={styles.currentUserRank}>#{currentUserEntry.rank}</Text>
            </View>
            <View style={styles.currentUserBody}>
              <View style={styles.currentUserAvatar}>
                <Avatar
                  entry={currentUserEntry}
                  size={44}
                  textStyle={styles.currentUserAvatarText}
                  imageStyle={styles.currentUserAvatarImg}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.currentUserName}>{currentUserEntry.userName}</Text>
                <Text style={styles.currentUserOrders}>{currentUserEntry.totalOrders} orders</Text>
              </View>
              <Text style={styles.currentUserSpent}>Rs.{currentUserEntry.totalSpent}</Text>
            </View>
          </View>
        )}
        {entries.slice(3).map((e, idx) => (
          <View key={e.userId} style={styles.entryCard}>
            <Text style={styles.entryRank}>#{idx + 4}</Text>
            <View style={styles.entryAvatar}>
              <Avatar entry={e} size={36} textStyle={styles.entryAvatarText} imageStyle={styles.entryAvatarImg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryName}>{e.userName}</Text>
              <Text style={styles.entryOrders}>{e.totalOrders} orders</Text>
            </View>
            <Text style={styles.entrySpent}>Rs.{e.totalSpent}</Text>
          </View>
        ))}
        {error ? (
          <View style={styles.empty}>
            <Icon name="alert-circle-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : entries.length === 0 && (
          <View style={styles.empty}>
            <Icon name="trophy-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No data yet</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 16, paddingVertical: 24 },
  podiumSpot: { alignItems: 'center', width: 90 },
  podiumFirst: { marginBottom: 20 },
  podiumAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.card, borderWidth: 3, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  podiumAvatarText: { fontSize: 20, fontWeight: '700', color: colors.text },
  podiumAvatarImg: { width: 56, height: 56, borderRadius: 28 },
  podiumName: { fontSize: 12, fontWeight: '600', color: colors.text },
  podiumRank: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  podiumSpent: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  list: { padding: 16 },
  currentUserCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  currentUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  currentUserLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  currentUserRank: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  currentUserBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentUserAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  currentUserAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  currentUserName: { fontSize: 15, fontWeight: '700', color: colors.text },
  currentUserOrders: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  currentUserSpent: { fontSize: 18, fontWeight: '800', color: colors.primary },
  entryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  entryRank: { fontSize: 14, fontWeight: '700', color: colors.textMuted, width: 30 },
  entryAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  entryAvatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  entryAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  entryName: { fontSize: 14, fontWeight: '600', color: colors.text },
  entryOrders: { fontSize: 11, color: colors.textMuted },
  entrySpent: { fontSize: 14, fontWeight: '700', color: colors.primary },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, color: colors.textMuted },
});
