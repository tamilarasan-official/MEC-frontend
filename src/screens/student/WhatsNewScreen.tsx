import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, ChangelogEntry } from '../../types';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import changelogService from '../../services/changelogService';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'WhatsNew'>;

const LAST_SEEN_KEY = '@madrasone_whats_new_seen';

const SECTION_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  new:      { icon: 'add',              color: '#22c55e', label: 'NEW FEATURES'  },
  improved: { icon: 'arrow-forward',    color: '#3b82f6', label: 'IMPROVEMENTS'  },
  fixed:    { icon: 'settings-outline', color: '#f59e0b', label: 'BUG FIXES'     },
};

const UPCOMING_TOASTS = [
  "Patience, young padawan ☕",
  "We're cooking something good 👨‍🍳",
  "Shh… it's still in the oven 🔥",
  "Good things take time ⏳",
  "We see you peeking 👀",
  "Soon™ — trust the process 🛠️",
  "Not yet! Check back later 🚀",
  "This one's still being baked 🍞",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isUpcoming(releaseDateStr: string): boolean {
  return new Date(releaseDateStr) > new Date();
}

export default function WhatsNewScreen({ navigation }: Props) {
  const styles = useMemo(() => createStyles(), []);
  const [entries, setEntries]         = useState<ChangelogEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState('');
  const [lastSeen, setLastSeen]       = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Toast state
  const [toastMsg, setToastMsg]   = useState('');
  const toastAnim                 = useRef(new Animated.Value(0)).current;
  const toastTimer                = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    toastTimer.current = setTimeout(() => setToastMsg(''), 2500);
  }, [toastAnim]);

  const load = async () => {
    try {
      const [data, seen] = await Promise.all([
        changelogService.getAll(),
        AsyncStorage.getItem(LAST_SEEN_KEY),
      ]);
      setEntries(data);
      setLastSeen(seen);
      // Expand all released versions by default; keep upcoming collapsed
      const released = data.filter(e => !isUpcoming(e.releaseDate)).map(e => e.id);
      setExpandedIds(new Set(released));
      const latestReleased = data.find(e => !isUpcoming(e.releaseDate));
      if (latestReleased) {
        await AsyncStorage.setItem(LAST_SEEN_KEY, latestReleased.version);
      }
    } catch {
      setError('Could not load release notes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleEntryPress = useCallback((entry: ChangelogEntry) => {
    if (isUpcoming(entry.releaseDate)) {
      const msg = UPCOMING_TOASTS[Math.floor(Math.random() * UPCOMING_TOASTS.length)];
      showToast(msg);
      return;
    }
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
  }, [showToast]);

  // Latest released version (first non-upcoming)
  const latestEntry   = entries.find(e => !isUpcoming(e.releaseDate));
  const latestVersion = latestEntry?.version ?? null;
  const year          = latestEntry
    ? new Date(latestEntry.releaseDate).getFullYear()
    : new Date().getFullYear();

  return (
    <ScreenWrapper
      barStyle="light-content"
      statusBarColor="#1a0d3a"
      style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>What's New</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />}>

          {/* Hero gradient */}
          <LinearGradient
            colors={['#1a0d3a', '#2d1b69', '#1a3a6e', '#0f2027']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}>
            {latestVersion && (
              <View style={styles.latestPill}>
                <View style={styles.latestDot} />
                <Text style={styles.latestPillText}>LATEST · v {latestVersion}</Text>
              </View>
            )}
            <Text style={styles.heroTitle}>What's new?</Text>
            <Text style={styles.heroSub}>Built with feedback from your campus.</Text>
          </LinearGradient>

          {/* Info row */}
          <View style={styles.infoRow}>
            <Icon name="information-circle-outline" size={16} color="#6b7280" />
            <Text style={styles.infoText}>
              {'A changelog of the latest '}
              <Text style={styles.infoBold}>CampusOne</Text>
              {' features, updates and fixes.'}
            </Text>
            <View style={styles.yearPill}>
              <Icon name="menu" size={12} color="#9ca3af" />
              <Text style={styles.yearText}>{year}</Text>
            </View>
          </View>

          {/* Timeline */}
          {entries.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No release notes yet.</Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {entries.map((entry, idx) => {
                const upcoming   = isUpcoming(entry.releaseDate);
                const isCurrent  = entry.version === latestVersion;
                const isLast     = idx === entries.length - 1;
                const isExpanded = expandedIds.has(entry.id);
                const isNew      = !upcoming && lastSeen !== null && entry.version > lastSeen;

                return (
                  <View key={entry.id} style={styles.timelineRow}>

                    {/* Left: dot + line */}
                    <View style={styles.timelineLeft}>
                      <View style={[
                        styles.timelineDot,
                        isCurrent  && styles.timelineDotCurrent,
                        upcoming   && styles.timelineDotUpcoming,
                      ]} />
                      {!isLast && <View style={[
                        styles.timelineLine,
                        upcoming && styles.timelineLineUpcoming,
                      ]} />}
                    </View>

                    {/* Card */}
                    <View style={[
                      styles.card,
                      isCurrent && styles.cardCurrent,
                      upcoming  && styles.cardUpcoming,
                    ]}>
                      <TouchableOpacity
                        style={styles.cardHeader}
                        onPress={() => handleEntryPress(entry)}
                        activeOpacity={0.8}>
                        <View style={styles.cardHeaderLeft}>
                          <Text style={styles.versionText}>Version {entry.version}</Text>
                          {upcoming && (
                            <View style={[styles.badge, styles.badgeUpcoming]}>
                              <Text style={styles.badgeText}>UPCOMING</Text>
                            </View>
                          )}
                          {isCurrent && !upcoming && (
                            <View style={[styles.badge, styles.badgeCurrent]}>
                              <Text style={styles.badgeText}>CURRENT</Text>
                            </View>
                          )}
                          {isNew && !isCurrent && !upcoming && (
                            <View style={[styles.badge, styles.badgeNew]}>
                              <Text style={styles.badgeText}>NEW</Text>
                            </View>
                          )}
                        </View>
                        <Icon
                          name={upcoming ? 'lock-closed-outline' : isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={upcoming ? '#6366f1' : '#6b7280'}
                        />
                      </TouchableOpacity>

                      <Text style={[styles.dateText, upcoming && styles.dateTextUpcoming]}>
                        {upcoming ? `Expected ${formatDate(entry.releaseDate)}` : formatDate(entry.releaseDate)}
                      </Text>

                      {upcoming && (
                        <View style={styles.upcomingHint}>
                          <Icon name="sparkles-outline" size={13} color="#6366f1" />
                          <Text style={styles.upcomingHintText}>Tap to get a sneak peek 😉</Text>
                        </View>
                      )}

                      {isExpanded && !upcoming && entry.sections.map((section, si) => {
                        const cfg = SECTION_CONFIG[section.type] ?? SECTION_CONFIG.new;
                        return (
                          <View key={si} style={styles.section}>
                            <View style={styles.sectionHeader}>
                              <View style={[styles.sectionIconCircle, { borderColor: cfg.color }]}>
                                <Icon name={cfg.icon} size={11} color={cfg.color} />
                              </View>
                              <Text style={[styles.sectionTitle, { color: cfg.color }]}>
                                {section.title || cfg.label}
                              </Text>
                            </View>
                            {section.items.map((item, ii) => (
                              <View key={ii} style={styles.itemRow}>
                                <View style={[styles.itemBullet, { backgroundColor: cfg.color }]} />
                                <Text style={styles.itemText}>{item}</Text>
                              </View>
                            ))}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 48 }} />
        </ScrollView>
      )}

      {/* Toast */}
      {toastMsg !== '' && (
        <Animated.View style={[styles.toast, {
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }]}>
          <Icon name="time-outline" size={16} color="#fff" />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}
    </ScreenWrapper>
  );
}

function createStyles() {
  return StyleSheet.create({
    root: { backgroundColor: '#0d0b1a' },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: '#1a0d3a',
    },
    backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#fff' },

    center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    errorText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 16 },
    retryBtn:  { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: '#7c3aed' },
    retryText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    hero: {
      paddingHorizontal: 20, paddingTop: 36, paddingBottom: 36,
    },
    latestPill: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignSelf: 'flex-start',
      borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
      marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    },
    latestDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 7 },
    latestPillText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.6 },
    heroTitle:      { fontSize: 36, fontWeight: '900', color: '#fff', marginBottom: 8, letterSpacing: -0.5 },
    heroSub:        { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },

    infoRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: '#120e24',
      borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
      gap: 8,
    },
    infoText: { flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 17 },
    infoBold: { fontWeight: '700', color: '#9ca3af' },
    yearPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    yearText: { fontSize: 11, fontWeight: '600', color: '#9ca3af' },

    empty:     { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 14, color: '#6b7280' },

    timeline:    { paddingHorizontal: 16, paddingTop: 24 },
    timelineRow: { flexDirection: 'row', marginBottom: 20 },

    timelineLeft: {
      width: 28, alignItems: 'center', marginRight: 12, marginTop: 4,
    },
    timelineDot: {
      width: 16, height: 16, borderRadius: 8,
      backgroundColor: '#2d1b69',
      borderWidth: 2, borderColor: '#7c3aed',
      zIndex: 1,
    },
    timelineDotCurrent:  { backgroundColor: '#7c3aed', borderColor: '#a78bfa' },
    timelineDotUpcoming: { backgroundColor: '#312e81', borderColor: '#6366f1', borderStyle: 'dashed' },
    timelineLine: {
      flex: 1, width: 2, marginTop: 4,
      backgroundColor: 'rgba(124,58,237,0.25)',
    },
    timelineLineUpcoming: { backgroundColor: 'rgba(99,102,241,0.2)' },

    card: {
      flex: 1, backgroundColor: '#1e1440',
      borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)',
    },
    cardCurrent:  { borderColor: 'rgba(124,58,237,0.55)' },
    cardUpcoming: {
      borderColor: 'rgba(99,102,241,0.35)',
      borderStyle: 'dashed',
      backgroundColor: '#1a1535',
    },

    cardHeader: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 4,
    },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    versionText:    { fontSize: 17, fontWeight: '800', color: '#fff' },

    badge:          { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    badgeCurrent:   { backgroundColor: '#7c3aed' },
    badgeNew:       { backgroundColor: '#22c55e' },
    badgeUpcoming:  { backgroundColor: '#312e81', borderWidth: 1, borderColor: '#6366f1' },
    badgeText:      { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

    dateText:         { fontSize: 12, color: '#6b7280', marginBottom: 12 },
    dateTextUpcoming: { color: '#6366f1' },

    upcomingHint: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: 'rgba(99,102,241,0.1)',
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    },
    upcomingHintText: { fontSize: 12, color: '#818cf8', fontWeight: '600' },

    section:       { marginBottom: 14 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    sectionIconCircle: {
      width: 20, height: 20, borderRadius: 10,
      borderWidth: 1.5,
      alignItems: 'center', justifyContent: 'center',
    },
    sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

    itemRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5, paddingLeft: 4 },
    itemBullet: { width: 5, height: 5, borderRadius: 3, marginTop: 7, flexShrink: 0 },
    itemText:   { fontSize: 13, color: '#d1d5db', lineHeight: 20, flex: 1 },

    toast: {
      position: 'absolute', bottom: 36, alignSelf: 'center',
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: '#312e81',
      paddingHorizontal: 18, paddingVertical: 12,
      borderRadius: 24,
      borderWidth: 1, borderColor: '#6366f1',
      elevation: 8, shadowColor: '#6366f1',
      shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
    },
    toastText: { fontSize: 13, fontWeight: '600', color: '#e0e7ff' },
  });
}
