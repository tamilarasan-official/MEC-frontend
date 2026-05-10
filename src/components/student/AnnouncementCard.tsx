import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import Icon from '../common/Icon';
import { Announcement } from '../../types';

interface Props {
  announcement: Announcement;
  width: number;
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

function AnnouncementCard({ announcement, width }: Props) {
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const [countdown, setCountdown] = useState(() => formatCountdown(announcement.expiresAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(formatCountdown(announcement.expiresAt));
    }, 60000);
    return () => clearInterval(timer);
  }, [announcement.expiresAt]);

  const cardBg = isDark ? '#2d1b4e' : '#f3e8ff';
  const titleColor = isDark ? '#c084fc' : '#7c3aed';
  const textColor = isDark ? '#e9d5ff' : '#4c1d95';
  const mutedColor = isDark ? '#a78bda' : '#7c3aed';
  const iconBg = isDark ? 'rgba(192,132,252,0.15)' : 'rgba(168,85,247,0.12)';

  return (
    <View style={[styles.card, { width, backgroundColor: cardBg }]}>
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
            {announcement.title}
          </Text>
          <Text style={[styles.message, { color: textColor }]} numberOfLines={3}>
            {announcement.message}
          </Text>
          <View style={styles.footer}>
            <Icon name="time-outline" size={11} color={mutedColor} />
            <Text style={[styles.countdown, { color: mutedColor }]}>{countdown}</Text>
          </View>
        </View>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Icon name="megaphone-outline" size={28} color={titleColor} />
        </View>
      </View>
    </View>
  );
}

export default React.memo(AnnouncementCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
    marginRight: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 20,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    opacity: 0.85,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countdown: {
    fontSize: 11,
    fontWeight: '500',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
});
