import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { MyStationeryRequest } from '../../types';
import stationeryRequestService from '../../services/stationeryRequestService';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();
}

export default function StationeryRequestsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [requests, setRequests] = useState<MyStationeryRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await stationeryRequestService.listMine());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadRequests().catch(() => setRequests([]));
    }
  }, [loadRequests, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Icon name="chatbox-ellipses-outline" size={20} color={colors.primary} />
              <Text style={styles.title}>Submitted Requests</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : requests.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No active requests</Text>
              <Text style={styles.emptyText}>Requests stay visible for 24 hours after submission.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {requests.map(request => (
                <View key={request.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.message} numberOfLines={3}>{request.message}</Text>
                    <View style={[styles.badge, request.resolved ? styles.badgeResolved : styles.badgePending]}>
                      <Text style={styles.badgeText}>{request.resolved ? 'Resolved' : 'Pending'}</Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>Submitted: {formatDateTime(request.createdAt)}</Text>
                  <Text style={styles.meta}>Auto-hide: {formatDateTime(request.expiresAt)}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.background,
    padding: 18,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  emptyBox: { padding: 18, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  emptyText: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  listContent: { gap: 10, paddingBottom: 18 },
  card: { padding: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  message: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgePending: { backgroundColor: '#f59e0b' },
  badgeResolved: { backgroundColor: '#10b981' },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  meta: { fontSize: 12, color: colors.textMuted },
});
