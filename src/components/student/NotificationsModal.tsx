import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector, useAppDispatch } from '../../store';
import { markNotificationRead, clearNotifications } from '../../store/slices/userSlice';
import walletService from '../../services/walletService';
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

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['55%', '95%'], []);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );

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
    walletService.clearAllNotifications().catch(() => {});
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const config = NOTIF_ICONS[item.type] || NOTIF_ICONS.system;
    const pickupToken = (item.data as Record<string, unknown>)?.pickupToken as string | undefined;
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
          {item.type === 'order' && pickupToken ? (
            <View style={styles.pickupRow}>
              <Icon name="qr-code-outline" size={12} color="#3b82f6" />
              <Text style={styles.pickupText}>Pickup ID: {pickupToken}</Text>
            </View>
          ) : null}
          <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = useMemo(() => (
    <>
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
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Icon name="close" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Connection status */}
      <View style={styles.statusBar}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Live</Text>
      </View>
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [unreadCount, notifications.length, styles, colors]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
    >
      {notifications.length === 0 ? (
        <BottomSheetView style={styles.contentPadding}>
          {ListHeader}
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Icon name="notifications-off-outline" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>
              You'll see order updates, wallet transactions, and announcements here
            </Text>
          </View>
        </BottomSheetView>
      ) : (
        <BottomSheetFlatList
          data={notifications}
          keyExtractor={(item: AppNotification) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          style={styles.notifList}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </BottomSheetModal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  contentPadding: { paddingHorizontal: 20 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
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
    paddingHorizontal: 20, paddingBottom: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  statusText: { fontSize: 11, fontWeight: '500', color: '#10b981' },

  // Notification list
  notifList: { flex: 1 },
  notifCard: {
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, marginHorizontal: 20,
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
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  pickupText: { fontSize: 12, fontWeight: '700', color: '#3b82f6' },
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
