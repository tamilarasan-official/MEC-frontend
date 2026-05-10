import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Skeleton loaders that mirror the exact layout of their real counterparts.
 * Show shimmer placeholders instead of a plain ActivityIndicator.
 */

/* ─── Food Card Skeleton (matches DashboardScreen food card: 88px height) ─── */
export function FoodCardSkeleton() {
  const { colors } = useTheme();
  const isDark = colors.background === '#000' || colors.background === '#0a0a0f';

  return (
    <SkeletonPlaceholder
      backgroundColor={isDark ? '#1e1e2e' : '#e5e7eb'}
      highlightColor={isDark ? '#2d2d3f' : '#f3f4f6'}
      speed={1200}
    >
      <View style={skeletonStyles.foodCard}>
        {/* Image placeholder */}
        <View style={skeletonStyles.foodImage} />
        {/* Text block */}
        <View style={skeletonStyles.foodInfo}>
          <View style={skeletonStyles.foodName} />
          <View style={skeletonStyles.foodPriceRow}>
            <View style={skeletonStyles.foodPrice} />
            <View style={skeletonStyles.foodAddBtn} />
          </View>
        </View>
      </View>
    </SkeletonPlaceholder>
  );
}

/** Renders N food card skeletons */
export function FoodCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={skeletonStyles.foodSkeletonList}>
      {Array.from({ length: count }).map((_, i) => (
        <FoodCardSkeleton key={i} />
      ))}
    </View>
  );
}

/* ─── Order Card Skeleton (matches OrdersScreen order card) ─── */
export function OrderCardSkeleton() {
  const { colors } = useTheme();
  const isDark = colors.background === '#000' || colors.background === '#0a0a0f';

  return (
    <SkeletonPlaceholder
      backgroundColor={isDark ? '#1e1e2e' : '#e5e7eb'}
      highlightColor={isDark ? '#2d2d3f' : '#f3f4f6'}
      speed={1200}
    >
      <View style={skeletonStyles.orderCard}>
        {/* Header row */}
        <View style={skeletonStyles.orderHeader}>
          <View style={skeletonStyles.orderIdLine} />
          <View style={skeletonStyles.orderStatusBadge} />
        </View>
        {/* Item rows */}
        {[1, 2].map(i => (
          <View key={i} style={skeletonStyles.orderItem}>
            <View style={skeletonStyles.orderItemImage} />
            <View style={skeletonStyles.orderItemText}>
              <View style={skeletonStyles.orderItemName} />
              <View style={skeletonStyles.orderItemQty} />
            </View>
            <View style={skeletonStyles.orderItemPrice} />
          </View>
        ))}
        {/* Footer */}
        <View style={skeletonStyles.orderFooter}>
          <View style={skeletonStyles.orderTotalLabel} />
          <View style={skeletonStyles.orderTotalValue} />
        </View>
      </View>
    </SkeletonPlaceholder>
  );
}

/** Renders N order card skeletons */
export function OrderCardSkeletonList({ count = 2 }: { count?: number }) {
  return (
    <View style={skeletonStyles.orderSkeletonList}>
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </View>
  );
}

/* ─── Leaderboard Skeleton ─── */
export function LeaderboardSkeleton() {
  const { colors } = useTheme();
  const isDark = colors.background === '#000' || colors.background === '#0a0a0f';

  return (
    <View style={skeletonStyles.leaderboardWrap}>
      <SkeletonPlaceholder
        backgroundColor={isDark ? '#1e1e2e' : '#e5e7eb'}
        highlightColor={isDark ? '#2d2d3f' : '#f3f4f6'}
        speed={1200}
      >
        {/* Podium */}
        <View style={skeletonStyles.podiumRow}>
          {[44, 56, 44].map((size, i) => (
            <View key={i} style={skeletonStyles.podiumSpot}>
              <View style={{ width: size, height: size, borderRadius: size / 2 }} />
              <View style={skeletonStyles.podiumNameLine} />
            </View>
          ))}
        </View>
        {/* List entries */}
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={skeletonStyles.entryRow}>
            <View style={skeletonStyles.entryRank} />
            <View style={skeletonStyles.entryAvatar} />
            <View style={skeletonStyles.entryNameBlock}>
              <View style={skeletonStyles.entryName} />
              <View style={skeletonStyles.entryOrders} />
            </View>
            <View style={skeletonStyles.entrySpent} />
          </View>
        ))}
      </SkeletonPlaceholder>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  /* Food card skeleton */
  foodSkeletonList: { gap: 10, paddingHorizontal: 16 },
  foodCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: 16,
    marginBottom: 10,
  },
  foodImage: { width: 68, height: 68, borderRadius: 12 },
  foodInfo: { flex: 1, justifyContent: 'space-between', paddingVertical: 4 },
  foodName: { width: '70%', height: 14, borderRadius: 6 },
  foodPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodPrice: { width: 50, height: 14, borderRadius: 6 },
  foodAddBtn: { width: 32, height: 32, borderRadius: 16 },

  /* Order card skeleton */
  orderSkeletonList: { gap: 14, padding: 16, paddingTop: 0 },
  orderCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  orderIdLine: { width: 120, height: 13, borderRadius: 6 },
  orderStatusBadge: { width: 80, height: 24, borderRadius: 10 },
  orderItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  orderItemImage: { width: 44, height: 44, borderRadius: 12 },
  orderItemText: { flex: 1, gap: 4 },
  orderItemName: { width: '60%', height: 14, borderRadius: 6 },
  orderItemQty: { width: 30, height: 12, borderRadius: 6 },
  orderItemPrice: { width: 50, height: 14, borderRadius: 6 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 12 },
  orderTotalLabel: { width: 40, height: 13, borderRadius: 6 },
  orderTotalValue: { width: 60, height: 17, borderRadius: 6 },

  /* Leaderboard skeleton */
  leaderboardWrap: { flex: 1, padding: 16 },
  podiumRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 24, paddingVertical: 24, marginBottom: 16 },
  podiumSpot: { alignItems: 'center', gap: 8 },
  podiumNameLine: { width: 60, height: 12, borderRadius: 6 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 8 },
  entryRank: { width: 24, height: 14, borderRadius: 6 },
  entryAvatar: { width: 36, height: 36, borderRadius: 18 },
  entryNameBlock: { flex: 1, gap: 4 },
  entryName: { width: '60%', height: 14, borderRadius: 6 },
  entryOrders: { width: 50, height: 11, borderRadius: 6 },
  entrySpent: { width: 50, height: 14, borderRadius: 6 },
});
