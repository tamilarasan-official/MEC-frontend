import React, { useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList,
  Animated,
} from 'react-native';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { markNotificationRead, clearNotifications } from '../../store/slices/userSlice';
import { AppNotification } from '../../types';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

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

export default function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { notifications } = useAppSelector(s => s.user);
  const unreadCount = notifications.filter(n => !n.read).length;

  const slideAnim = useMemo(() => new Animated.Value(600), []);

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(600);
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }).start();
    }
  }, [visible, slideAnim]);

  const NOTIF_ICONS: Record<string, { icon: string; color: string; bg: string }> = useMemo(() => ({
    order: { icon: 'bag-handle-outline', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    wallet: { icon: 'wallet-outline', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    announcement: { icon: 'megaphone-outline', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
    system: { icon: 'information-circle-outline', color: colors.mutedForeground, bg: colors.surface },
  }), [colors]);

  const handleMarkRead = (id: string) => {
    dispatch(markNotificationRead(id));
  };

  const handleClearAll = () => {
    dispatch(clearNotifications());
  };

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
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={styles.kvWrapper}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Drag handle */}
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn} activeOpacity={0.7}>
                  <Text style={styles.clearText}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Icon name="close" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Connection status */}
          <View style={styles.statusBar}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Live</Text>
          </View>

          {/* Notification List */}
          {notifications.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Icon name="notifications-off-outline" size={36} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySubtitle}>
                You'll see order updates, wallet transactions, and announcements here
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              style={styles.notifList}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  kvWrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '85%',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, maxHeight: '100%',
  },
  handleBar: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  headerBadge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 5 },
  clearText: { fontSize: 13, fontWeight: '600', color: '#3b82f6' },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingBottom: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  statusText: { fontSize: 11, fontWeight: '500', color: '#10b981' },

  // Notification list
  notifList: { maxHeight: 420 },
  notifCard: {
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  notifUnread: { backgroundColor: 'rgba(59,130,246,0.04)', borderColor: 'rgba(59,130,246,0.2)' },
  notifIcon: {
    width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  notifTitle: { fontSize: 14, fontWeight: '500', color: colors.foreground, flex: 1 },
  notifTitleUnread: { fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' },
  notifMessage: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 11, color: colors.mutedForeground },

  // Empty
  emptyWrap: { paddingVertical: 50, alignItems: 'center', gap: 10, paddingHorizontal: 30 },
  emptyIconWrap: {
    width: 70, height: 70, borderRadius: 22, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  emptySubtitle: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
});
