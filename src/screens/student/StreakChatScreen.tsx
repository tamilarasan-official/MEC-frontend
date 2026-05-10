import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchMonthlySummary, fetchLeaderboardPreview, fetchWeeklyChallenge, setSelectedMonth } from '../../store/slices/streakSlice';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import HeatmapGrid from '../../components/student/HeatmapGrid';
import PersonalityCard from '../../components/student/PersonalityCard';
import StreakChatCard from '../../components/student/StreakChatCard';
import WeeklyChallengeModal from '../../components/student/WeeklyChallengeModal';
import { resolveImageUrl } from '../../utils/imageUrl';
import mealComplianceService, { MealComplianceTodayResponse } from '../../services/mealComplianceService';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'StreakChat'>;
type StreakHeaderIcon = 'restaurant-outline' | 'sparkles-outline' | 'trophy-outline' | 'stats-chart-outline';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function StreakChatScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const { summary, leaderboardPreview, weeklyChallenge, selectedMonth, selectedYear, loading, leaderboardLoading } = useAppSelector(s => s.streak);
  const [refreshing, setRefreshing] = useState(false);
  const [heatmapPage, setHeatmapPage] = useState(0);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [mealComplianceToday, setMealComplianceToday] = useState<MealComplianceTodayResponse | null>(null);
  // Section card = screenWidth - 32 (scroll container has 16px padding each side)
  const heatmapPageWidth = Dimensions.get('window').width - 32;

  const now = new Date();
  const minYear = now.getFullYear() - 1;

  // Reset to current month every time the screen is opened
  useEffect(() => {
    dispatch(setSelectedMonth({ month: now.getMonth() + 1, year: now.getFullYear() }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(() => {
    dispatch(fetchMonthlySummary({ month: selectedMonth, year: selectedYear }));
    dispatch(fetchLeaderboardPreview());
    dispatch(fetchWeeklyChallenge());
  }, [dispatch, selectedMonth, selectedYear]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (user?.userTag !== 'Hosteller') {
      setMealComplianceToday(null);
      return;
    }
    mealComplianceService.getToday()
      .then(setMealComplianceToday)
      .catch(() => undefined);
  }, [user?.userTag]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchMonthlySummary({ month: selectedMonth, year: selectedYear })),
      dispatch(fetchLeaderboardPreview()),
      dispatch(fetchWeeklyChallenge()),
    ]);
    if (user?.userTag === 'Hosteller') {
      try {
        setMealComplianceToday(await mealComplianceService.getToday());
      } catch { /* ignore */ }
    }
    setRefreshing(false);
  };

  const goPrevMonth = () => {
    let m = selectedMonth - 1;
    let y = selectedYear;
    if (m < 1) { m = 12; y -= 1; }
    if (y < minYear) return;
    setHeatmapPage(0);
    dispatch(setSelectedMonth({ month: m, year: y }));
  };

  const goNextMonth = () => {
    let m = selectedMonth + 1;
    let y = selectedYear;
    if (m > 12) { m = 1; y += 1; }
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)) return;
    setHeatmapPage(0);
    dispatch(setSelectedMonth({ month: m, year: y }));
  };

  const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();

  const statTiles = summary ? [
    { icon: 'restaurant-outline', label: 'Total Meals', value: `${summary.totalOrders}`, sub: 'orders placed' },
    { icon: 'card-outline', label: 'Total Spent', value: `₹${summary.totalSpent.toLocaleString('en-IN')}`, sub: 'this month' },
    { icon: 'flame-outline', label: 'Best Streak', value: `${summary.longestStreak}`, sub: 'days in a row' },
    { icon: 'leaf-outline', label: 'Veg Days', value: `${summary.vegDays}`, sub: 'full veg days' },
  ] : [];

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Streak</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {/* Streak banner card */}
        <View style={styles.bannerWrap}>
          <StreakChatCard
            summary={summary}
            leaderboard={leaderboardPreview}
            weeklyChallenge={weeklyChallenge}
            month={selectedMonth}
            year={selectedYear}
            onPress={() => {}}
            onGiftBoxPress={() => setShowWeeklyModal(true)}
          />
        </View>

        {user?.userTag === 'Hosteller' && mealComplianceToday && (
          <TouchableOpacity style={styles.complianceCard} activeOpacity={0.85} onPress={() => navigation.navigate('MealComplianceHistory')}>
            <SectionHeader icon="restaurant-outline" title="Today's Meal Compliance" textColor={colors.text} />
            {mealComplianceToday.holiday && (
              <View style={styles.complianceHoliday}>
                <Text style={styles.complianceHolidayText}>
                  Holiday lock active{mealComplianceToday.holiday.name ? ` · ${mealComplianceToday.holiday.name}` : ''}
                </Text>
              </View>
            )}
            {mealComplianceToday.sessions.map(session => (
              <View key={session.sessionType} style={styles.complianceRow}>
                <View>
                  <Text style={styles.complianceName}>{session.sessionType[0].toUpperCase() + session.sessionType.slice(1)}</Text>
                  <Text style={styles.complianceTime}>{session.startTime} - {session.endTime}</Text>
                </View>
                <Text style={[
                  styles.complianceStatus,
                  session.status === 'debited' && styles.complianceStatusMissed,
                  session.status === 'eaten' && styles.complianceStatusAte,
                ]}>
                  {session.status === 'debited' ? `Missed · Rs.${session.amount || 0}` : session.status}
                </Text>
              </View>
            ))}
          </TouchableOpacity>
        )}

        {/* Month selector */}
        <View style={styles.monthRow}>
          <TouchableOpacity style={styles.monthArrow} onPress={goPrevMonth} accessibilityRole="button" accessibilityLabel="Previous month">
            <Icon name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</Text>
          <TouchableOpacity
            style={[styles.monthArrow, isCurrentMonth && styles.monthArrowDisabled]}
            onPress={goNextMonth}
            disabled={isCurrentMonth}
            accessibilityRole="button"
            accessibilityLabel="Next month">
            <Icon name="chevron-forward" size={20} color={isCurrentMonth ? colors.textMuted : colors.text} />
          </TouchableOpacity>
        </View>

        {loading && !summary ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* ── Section 1: Per-shop heatmap swipe cards ── */}
            <View style={[styles.section, styles.sectionNoPadX]}>
              <View style={styles.sectionPadX}>
                {summary && (
                  <View style={styles.streakBanner}>
                    <Text style={styles.streakBannerText}>
                      {summary.currentStreak > 0
                        ? `${summary.currentStreak} day streak`
                        : 'Start your streak today!'}
                    </Text>
                    <Text style={styles.streakBannerSub}>
                      Ate on {summary.heatmap.filter(d => d.orderCount > 0).length} days · Missed {summary.heatmap.filter(d => d.orderCount === 0).length} days
                    </Text>
                  </View>
                )}
              </View>

              {summary && (
                <>
                  {(() => {
                    // Always show global 'All Canteens' page first (has real colors),
                    // then append per-shop pages if the user ordered from multiple shops
                    const globalPage = { shopId: 'all', shopName: 'All Canteens', heatmap: summary.heatmap };
                    const pages = summary.shopBreakdowns.length > 1
                      ? [globalPage, ...summary.shopBreakdowns]
                      : summary.shopBreakdowns.length === 1
                        ? summary.shopBreakdowns  // single shop: just show that shop
                        : [globalPage];
                    return (
                      <>
                        <ScrollView
                          horizontal
                          pagingEnabled
                          showsHorizontalScrollIndicator={false}
                          decelerationRate="fast"
                          scrollEventThrottle={16}
                          onMomentumScrollEnd={e => {
                            const page = Math.round(e.nativeEvent.contentOffset.x / heatmapPageWidth);
                            setHeatmapPage(page);
                          }}>
                          {pages.map(item => (
                            <View key={item.shopId} style={[styles.heatmapPage, { width: heatmapPageWidth }]}>
                              <Text style={[styles.shopLabel, { color: colors.text }]}>{item.shopName}</Text>
                              <HeatmapGrid
                                heatmap={item.heatmap}
                                month={selectedMonth}
                                year={selectedYear}
                              />
                            </View>
                          ))}
                        </ScrollView>
                        {pages.length > 1 && (
                          <View style={styles.pageDots}>
                            {pages.map((_, i) => (
                              <View key={i} style={[styles.pageDot, i === heatmapPage && styles.pageDotActive]} />
                            ))}
                          </View>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
              <View style={styles.sectionPadBottom} />
            </View>

            {/* ── Section 2: Your Personality ── */}
            {summary?.personality && (
              <View style={styles.section}>
                <SectionHeader icon="sparkles-outline" title="This Month You Are…" textColor={colors.text} />
                <PersonalityCard personality={summary.personality} />
              </View>
            )}

            {/* ── Section 3: Top Foods ── */}
            {summary && summary.topFoods.length > 0 && (
              <View style={styles.section}>
                <SectionHeader icon="restaurant-outline" title="Most Eaten This Month" textColor={colors.text} />
                {summary.topFoods.map((food, idx) => {
                  const maxCount = summary.topFoods[0].count;
                  const barWidth = maxCount > 0 ? (food.count / maxCount) * 100 : 0;
                  const barColors = ['#10b981', '#3b82f6', '#8b5cf6'];
                  return (
                    <View key={food.itemId + idx} style={styles.topFoodRow}>
                      <View style={styles.topFoodImageWrap}>
                        {food.imageUrl ? (
                          <Image
                            source={{ uri: resolveImageUrl(food.imageUrl) ?? undefined }}
                            style={styles.topFoodImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.topFoodImage, styles.topFoodImagePlaceholder]}>
                            <Icon name="restaurant-outline" size={16} color={colors.textMuted} />
                          </View>
                        )}
                      </View>
                      <View style={styles.topFoodInfo}>
                        <View style={styles.topFoodNameRow}>
                          <Text style={styles.topFoodName} numberOfLines={1}>{food.name}</Text>
                          <Text style={styles.topFoodCount}>×{food.count}</Text>
                        </View>
                        <View style={styles.topFoodBarBg}>
                          <View style={[styles.topFoodBar, { width: `${barWidth}%`, backgroundColor: barColors[idx] || '#10b981' }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Section 4: Leaderboard Preview ── */}
            <View style={styles.section}>
              <SectionHeader icon="trophy-outline" title="This Month's Top Spenders" textColor={colors.text} />
              {leaderboardLoading && !leaderboardPreview ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
              ) : leaderboardPreview ? (
                <>
                  {leaderboardPreview.userEntry && (
                    <View style={styles.myRankBanner}>
                      <Text style={styles.myRankText}>
                        You are #{leaderboardPreview.userRank} this month
                      </Text>
                      {leaderboardPreview.userEntry.totalSpent > 0 && (
                        <Text style={styles.myRankSub}>
                          ₹{leaderboardPreview.userEntry.totalSpent.toLocaleString('en-IN')} spent
                        </Text>
                      )}
                    </View>
                  )}

                  {leaderboardPreview.top3.map((entry, idx) => {
                    const podiumColors = ['#eab308', '#94a3b8', '#d97706'];
                    const isMe = entry.userId === leaderboardPreview.userEntry?.userId;
                    return (
                      <View key={entry.userId} style={[styles.lbRow, isMe && styles.lbRowHighlight]}>
                        <View style={styles.lbIconWrap}>
                          <Icon name={idx === 0 ? 'trophy' : 'medal-outline'} size={20} color={podiumColors[idx]} />
                        </View>
                        <View style={[styles.lbAvatar, { borderColor: podiumColors[idx] }]}>
                          {entry.avatarUrl ? (
                            <Image source={{ uri: resolveImageUrl(entry.avatarUrl) ?? undefined }} style={styles.lbAvatarImg} />
                          ) : (
                            <Text style={styles.lbAvatarInitial}>{(entry.userName[0] || 'S').toUpperCase()}</Text>
                          )}
                        </View>
                        <View style={styles.lbInfo}>
                          <Text style={styles.lbName} numberOfLines={1}>{entry.userName.split(' ')[0]}</Text>
                          <Text style={styles.lbSpent}>₹{entry.totalSpent.toLocaleString('en-IN')}</Text>
                        </View>
                        {isMe && <View style={styles.meBadge}><Text style={styles.meBadgeText}>You</Text></View>}
                      </View>
                    );
                  })}

                  <TouchableOpacity
                    style={styles.seeFullBtn}
                    onPress={() => navigation.navigate('Leaderboard')}
                    activeOpacity={0.8}>
                    <Text style={styles.seeFullText}>See full leaderboard</Text>
                    <Icon name="arrow-forward" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>

            {/* ── Section 6: Stats Grid ── */}
            {summary && (
              <View style={styles.section}>
                <SectionHeader icon="stats-chart-outline" title="Month Summary" textColor={colors.text} />
                <View style={styles.statsGrid}>
                  {statTiles.map(tile => (
                    <View key={tile.label} style={[styles.statTile, { backgroundColor: colors.card }]}>
                      <Icon name={tile.icon as any} size={22} color={colors.primary} />
                      <Text style={styles.statTileValue}>{tile.value}</Text>
                      <Text style={styles.statTileLabel}>{tile.label}</Text>
                      <Text style={styles.statTileSub}>{tile.sub}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <WeeklyChallengeModal
        visible={showWeeklyModal}
        weeklyChallenge={weeklyChallenge}
        onClose={() => setShowWeeklyModal(false)}
      />
    </ScreenWrapper>
  );
}

function SectionHeader({ icon, title, textColor }: { icon: StreakHeaderIcon; title: string; textColor: string }) {
  return (
    <View style={sectionHeaderStyles.row}>
      <Icon name={icon} size={16} color={textColor} />
      <Text style={[sectionHeaderStyles.title, { color: textColor }]}>{title}</Text>
    </View>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '800' },
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text },
    scroll: { paddingHorizontal: 16, paddingTop: 12 },
    bannerWrap: { marginBottom: 16 },
    complianceCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    complianceHoliday: {
      backgroundColor: 'rgba(245,158,11,0.14)',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 10,
    },
    complianceHolidayText: { color: '#b45309', fontSize: 12, fontWeight: '700' },
    complianceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    complianceName: { fontSize: 14, fontWeight: '700', color: colors.text },
    complianceTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    complianceStatus: { fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize', fontWeight: '700' },
    complianceStatusMissed: { color: '#ef4444' },
    complianceStatusAte: { color: '#10b981' },
    loaderWrap: { paddingVertical: 60, alignItems: 'center' },

    // Month selector
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    monthArrow: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    monthArrowDisabled: { opacity: 0.3 },
    monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },

    // Sections
    section: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 6,
    },
    sectionNoPadX: { paddingHorizontal: 0 },
    sectionPadX: { paddingHorizontal: 16 },
    sectionPadBottom: { height: 16 },

    // Per-shop heatmap pager
    heatmapPage: { paddingHorizontal: 16 },
    shopLabel: { fontSize: 13, fontWeight: '700', marginBottom: 10, opacity: 0.6 },
    pageDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 10 },
    pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    pageDotActive: { width: 18, backgroundColor: '#7c3aed' },

    // Streak banner
    streakBanner: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 10,
      marginBottom: 12,
      alignItems: 'center',
    },
    streakBannerText: { fontSize: 15, fontWeight: '800', color: colors.text },
    streakBannerSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

    // Sessions
    pillsRow: { flexDirection: 'row', gap: 8 },

    // Top foods
    topFoodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
    topFoodImageWrap: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden' },
    topFoodImage: { width: 44, height: 44, borderRadius: 10 },
    topFoodImagePlaceholder: {
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topFoodInfo: { flex: 1 },
    topFoodNameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    topFoodName: { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 },
    topFoodCount: { fontSize: 12, fontWeight: '700', color: colors.primary, marginLeft: 6 },
    topFoodBarBg: { height: 6, backgroundColor: colors.surface, borderRadius: 3 },
    topFoodBar: { height: 6, borderRadius: 3 },

    // Leaderboard
    myRankBanner: {
      backgroundColor: colors.primaryBg,
      borderRadius: 10,
      padding: 10,
      marginBottom: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    myRankText: { fontSize: 14, fontWeight: '800', color: colors.primary },
    myRankSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    lbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 10,
    },
    lbRowHighlight: {
      backgroundColor: colors.primaryBg,
      borderRadius: 10,
      paddingHorizontal: 8,
    },
    lbIconWrap: { width: 28, alignItems: 'center', justifyContent: 'center' },
    lbAvatar: {
      width: 36, height: 36, borderRadius: 18, borderWidth: 2,
      overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    lbAvatarImg: { width: 36, height: 36, borderRadius: 18 },
    lbAvatarInitial: { fontSize: 15, fontWeight: '700', color: colors.text },
    lbInfo: { flex: 1 },
    lbName: { fontSize: 13, fontWeight: '700', color: colors.text },
    lbSpent: { fontSize: 12, color: colors.textMuted },
    meBadge: {
      backgroundColor: colors.primary,
      borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
    },
    meBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    seeFullBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 8,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    seeFullText: { fontSize: 13, fontWeight: '700', color: colors.primary },

    // Stats grid
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statTile: {
      width: '47%',
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
    },
    statTileValue: { fontSize: 20, fontWeight: '900', color: colors.text },
    statTileLabel: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 2 },
    statTileSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  });
}
