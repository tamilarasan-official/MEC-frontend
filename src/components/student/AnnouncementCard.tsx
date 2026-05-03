import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import Icon from '../common/Icon';
import { Announcement } from '../../types';

interface Props {
  announcement: Announcement;
}

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `Expires in ${hours} h ${minutes} m`;
  return `Expires in ${minutes} m`;
}

export default function AnnouncementCard({ announcement }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [countdown, setCountdown] = useState(() => formatCountdown(announcement.expiresAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(formatCountdown(announcement.expiresAt));
    }, 60000);
    return () => clearInterval(timer);
  }, [announcement.expiresAt]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Icon name="megaphone-outline" size={16} color="#f97316" />
        </View>
        <Text style={styles.label}>ANNOUNCEMENT</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{announcement.title}</Text>
      <Text style={styles.message} numberOfLines={3}>{announcement.message}</Text>
      <View style={styles.footer}>
        <Icon name="time-outline" size={12} color={colors.textMuted} />
        <Text style={styles.countdown}>{countdown}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(249,115,22,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f97316',
    letterSpacing: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countdown: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
