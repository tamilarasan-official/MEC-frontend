import React, { useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector } from '../../store';

const IMAGE_BASE = 'https://backend.mec.welocalhost.com';
function resolveAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${IMAGE_BASE}${url}`;
}

interface OwnerHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showSearch: boolean;
  onToggleSearch: () => void;
  onProfilePress: () => void;
  todayRevenue?: number;
  onAnalyticsPress?: () => void;
  onRevenuePress?: () => void;
}

export default function OwnerHeader({
  searchQuery, onSearchChange, showSearch, onToggleSearch, onProfilePress,
  todayRevenue, onAnalyticsPress, onRevenuePress,
}: OwnerHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAppSelector(s => s.auth.user);
  const avatarUri = resolveAvatarUrl(user?.avatarUrl);

  if (showSearch) {
    return (
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Icon name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order number..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoFocus
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity onPress={onToggleSearch} style={styles.cancelBtn} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      {/* Left: Logo + Revenue Badge */}
      <View style={styles.leftSection}>
        <Image
          source={require('../../assets/icons/appicon.png')}
          style={styles.logoImg}
          resizeMode="contain"
        />
        {todayRevenue != null && (
          <TouchableOpacity style={styles.revenueBadge} activeOpacity={0.7} onPress={onRevenuePress}>
            <Icon name="briefcase" size={13} color="#f97316" />
            <Text style={styles.revenueText}>Rs. {todayRevenue}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Right: Search + Analytics + Avatar */}
      <View style={styles.rightActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onToggleSearch} activeOpacity={0.7}>
          <Icon name="search" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        {onAnalyticsPress && (
          <TouchableOpacity style={styles.iconBtn} onPress={onAnalyticsPress} activeOpacity={0.7}>
            <Icon name="pie-chart" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.avatarBtn} onPress={onProfilePress} activeOpacity={0.7}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>
              {user?.name?.[0]?.toUpperCase() || 'O'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  leftSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 36, height: 36, borderRadius: 10 },
  revenueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
  },
  revenueText: { fontSize: 12, fontWeight: '700', color: '#f97316' },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarBtn: {
    width: 36, height: 36, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImg: { width: 36, height: 36, borderRadius: 12 },
  avatarText: { fontSize: 14, fontWeight: '700', color: colors.accent },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: colors.foreground, padding: 0,
  },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  cancelText: { fontSize: 14, fontWeight: '500', color: colors.mutedForeground },
});
