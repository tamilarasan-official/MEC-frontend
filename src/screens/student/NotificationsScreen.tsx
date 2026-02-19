import React, { useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList, AppNotification } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { markNotificationRead, clearNotifications } from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'Notifications'>;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const NOTIF_ICONS: Record<string, { icon: string; color: string; bg: string }> = useMemo(() => ({
    order: { icon: 'bag-handle-outline', color: colors.blue[500], bg: 'rgba(59,130,246,0.1)' },
    wallet: { icon: 'wallet-outline', color: colors.primary, bg: 'rgba(16,185,129,0.1)' },
    announcement: { icon: 'megaphone-outline', color: colors.orange[500], bg: 'rgba(249,115,22,0.1)' },
    system: { icon: 'information-circle-outline', color: colors.textMuted, bg: colors.surface },
  }), [colors]);
  const dispatch = useAppDispatch();
  const { notifications } = useAppSelector(s => s.user);

  const handleMarkRead = useCallback((id: string) => {
    dispatch(markNotificationRead(id));
  }, [dispatch]);

  const handleClearAll = useCallback(() => {
    dispatch(clearNotifications());
  }, [dispatch]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderItem = ({ item }: { item: AppNotification }) => {
    const config = NOTIF_ICONS[item.type] || NOTIF_ICONS.system;
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.read && styles.notifUnread]}
        onPress={() => handleMarkRead(item.id)}
        activeOpacity={0.7}>
        <View style={[styles.notifIcon, { backgroundColor: config.bg }]}>
          <Icon name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {notifications.length > 0 ? (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        ) : <View style={styles.clearBtnSpacer} />}
      </View>

      {/* Connection status */}
      <View style={styles.statusBar}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Live</Text>
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Icon name="notifications-off-outline" size={48} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>
              You'll see order updates, wallet transactions, and announcements here
            </Text>
          </View>
        }
      />
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  headerBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  clearText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  statusText: { fontSize: 11, fontWeight: '500', color: colors.primary },
  listContent: { padding: 16, paddingBottom: 40 },
  notifCard: {
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  notifUnread: { backgroundColor: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.2)' },
  notifIcon: {
    width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  notifTitle: { fontSize: 14, fontWeight: '500', color: colors.text, flex: 1 },
  notifTitleUnread: { fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  notifMessage: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 11, color: colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  clearBtnSpacer: { width: 60 },
});
