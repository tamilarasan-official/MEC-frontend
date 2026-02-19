import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, LeaderboardEntry } from '../../types';
import walletService from '../../services/walletService';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Leaderboard'>;

export default function LeaderboardScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const data = await walletService.getLeaderboard();
      setEntries(data);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const podiumColors = ['#eab308', '#94a3b8', '#d97706']; // Gold, Silver, Bronze

  if (loading) {
    return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
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
                  <Text style={styles.podiumAvatarText}>{e.userName?.charAt(0)?.toUpperCase()}</Text>
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
        {entries.slice(3).map((e, idx) => (
          <View key={e.userId} style={styles.entryCard}>
            <Text style={styles.entryRank}>#{idx + 4}</Text>
            <View style={styles.entryAvatar}>
              <Text style={styles.entryAvatarText}>{e.userName?.charAt(0)?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryName}>{e.userName}</Text>
              <Text style={styles.entryOrders}>{e.totalOrders} orders</Text>
            </View>
            <Text style={styles.entrySpent}>Rs.{e.totalSpent}</Text>
          </View>
        ))}
        {entries.length === 0 && (
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
  podiumName: { fontSize: 12, fontWeight: '600', color: colors.text },
  podiumRank: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  podiumSpent: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  list: { padding: 16 },
  entryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  entryRank: { fontSize: 14, fontWeight: '700', color: colors.textMuted, width: 30 },
  entryAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  entryAvatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  entryName: { fontSize: 14, fontWeight: '600', color: colors.text },
  entryOrders: { fontSize: 11, color: colors.textMuted },
  entrySpent: { fontSize: 14, fontWeight: '700', color: colors.primary },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, color: colors.textMuted },
});
