import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, TextInput,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../../store';
import {
  fetchShopDetails, fetchQRPayments, fetchWalletBalance,
} from '../../store/slices/userSlice';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import OwnerProfileDropdown from '../../components/owner/OwnerProfileDropdown';
import OwnerWalletModal from '../../components/owner/OwnerWalletModal';
import CreateQRPaymentModal from '../../components/owner/CreateQRPaymentModal';
import QRPaymentDisplayModal from '../../components/owner/QRPaymentDisplayModal';
import { QRPayment } from '../../types';

const IMAGE_BASE = 'https://backend.mec.welocalhost.com';
function resolveAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${IMAGE_BASE}${url}`;
}

// ---- Stat Item ----
function StatItem({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

// ---- QR Payment Card ----
function QRPaymentCard({ payment, colors, styles, onPress }: { payment: QRPayment; colors: ThemeColors; styles: ReturnType<typeof createStyles>; onPress: () => void }) {
  const hasPayers = payment.payers && payment.payers.length > 0;
  const isPaid = payment.paidCount > 0;

  return (
    <TouchableOpacity style={styles.qrCard} activeOpacity={0.7} onPress={onPress}>
      {/* Badges */}
      <View style={styles.qrCardBadges}>
        <View style={styles.qrTypeBadge}>
          <Icon name="qr-code-outline" size={10} color="#06b6d4" />
          <Text style={styles.qrTypeBadgeText}>QR PAYMENT</Text>
        </View>
        {isPaid && (
          <View style={styles.statusBadgePaid}>
            <Icon name="checkmark-circle-outline" size={10} color="#22c55e" />
            <Text style={styles.paidBadgeText}>Paid</Text>
          </View>
        )}
      </View>

      {/* Title & Amount */}
      <Text style={styles.qrCardTitle}>{payment.title}</Text>
      <Text style={styles.qrCardAmount}>
        Rs. {payment.amount}
        {isPaid ? ` · Collected: Rs. ${payment.totalCollected}` : ''}
      </Text>

      {/* Payer info */}
      {hasPayers && (
        <View style={styles.payerSection}>
          {payment.payers.slice(0, 3).map((payer, idx) => (
            <View key={idx} style={styles.payerRow}>
              <View style={styles.payerLeft}>
                <Icon name="person-outline" size={14} color={colors.mutedForeground} />
                <Text style={styles.payerName} numberOfLines={1}>
                  {payer.studentName}
                  {payer.studentRollNumber ? ` (${payer.studentRollNumber})` : ''}
                </Text>
              </View>
              <Text style={styles.payerDate}>
                {new Date(payer.paidAt).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short',
                })}, {new Date(payer.paidAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit', minute: '2-digit', hour12: true,
                }).toLowerCase()}
              </Text>
            </View>
          ))}
          {payment.payers.length > 3 && (
            <Text style={styles.morePayersText}>+{payment.payers.length - 3} more</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function StationeryHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();

  const user = useAppSelector(s => s.auth.user);
  const shopDetails = useAppSelector(s => s.user.shopDetails);
  const qrPayments = useAppSelector(s => s.user.qrPayments);
  const qrPaymentsLoading = useAppSelector(s => s.user.qrPaymentsLoading);
  const balance = useAppSelector(s => s.user.balance);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<QRPayment | null>(null);
  const [showQRDisplay, setShowQRDisplay] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const avatarUri = resolveAvatarUrl(user?.avatarUrl);

  // Filter QR payments by search query
  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) return qrPayments;
    const q = searchQuery.toLowerCase();
    return qrPayments.filter(p => p.title.toLowerCase().includes(q));
  }, [qrPayments, searchQuery]);

  // Computed stats (based on all payments, not filtered)
  const totalCollected = qrPayments.reduce((sum, p) => sum + (p.totalCollected || 0), 0);
  const totalPaymentCount = qrPayments.reduce((sum, p) => sum + (p.paidCount || 0), 0);
  const activeCount = qrPayments.filter(p => p.status === 'active').length;
  const paidCount = qrPayments.filter(p => p.status !== 'active').length;

  const handleCardPress = (payment: QRPayment) => {
    setSelectedPayment(payment);
    setShowQRDisplay(true);
  };

  const canGenerateQR = shopDetails?.canGenerateQR === true;

  const fetchData = useCallback(async () => {
    try {
      await Promise.all([
        dispatch(fetchShopDetails()),
        dispatch(fetchQRPayments()),
        dispatch(fetchWalletBalance()),
      ]);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/icons/appicon.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <TouchableOpacity style={styles.walletPill} onPress={() => setShowWallet(true)} activeOpacity={0.8}>
            <Icon name="wallet-outline" size={13} color="#f97316" />
            <Text style={styles.walletPillText}>Rs. {balance || 0}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            activeOpacity={0.7}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Icon name="search" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Analytics')}
          >
            <Icon name="time-outline" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileIcon} activeOpacity={0.7} onPress={() => setShowProfile(true)}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.profileAvatarImg} />
            ) : (
              <Text style={styles.profileInitial}>{user?.name?.[0]?.toUpperCase() || 'S'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchBarRow}>
          <View style={styles.searchBar}>
            <Icon name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search orders by number..."
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
          </View>
          <TouchableOpacity
            onPress={() => { setShowSearch(false); setSearchQuery(''); }}
            activeOpacity={0.7}
          >
            <Text style={styles.searchCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Total Collected Card */}
        {canGenerateQR && (
          <LinearGradient
            colors={['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.totalCard}
          >
            <View style={styles.totalCardHeader}>
              <Icon name="logo-usd" size={18} color="#10b981" />
              <Text style={styles.totalCardLabel}>Total Collected</Text>
            </View>
            <Text style={styles.totalCardAmount}>Rs. {totalCollected}</Text>
            <Text style={styles.totalCardSub}>{totalPaymentCount} payments received</Text>
          </LinearGradient>
        )}

        {/* QR Payment Overview */}
        {canGenerateQR && (
          <LinearGradient
            colors={['rgba(139,92,246,0.15)', 'rgba(139,92,246,0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.overviewCard}
          >
            <View style={styles.overviewHeader}>
              <Text style={styles.overviewTitle}>QR PAYMENT OVERVIEW</Text>
              <TouchableOpacity onPress={onRefresh} activeOpacity={0.7}>
                <Icon name="refresh-outline" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <View style={styles.statsRow}>
              <StatItem value={qrPayments.length} label="Total QR" color="#8b5cf6" />
              <StatItem value={paidCount} label="Paid" color="#22c55e" />
              <StatItem value={activeCount} label="Active" color="#3b82f6" />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#f97316' }}>₹</Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#f97316' }}>{totalCollected}</Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Collected</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* QR Payments List Section */}
        {canGenerateQR && (
          <View style={styles.qrSection}>
            <View style={styles.qrSectionHeader}>
              <View style={styles.qrSectionTitleRow}>
                <Icon name="qr-code-outline" size={20} color={colors.foreground} />
                <Text style={styles.qrSectionTitle}>QR Payments</Text>
              </View>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => setShowCreateModal(true)}
                activeOpacity={0.7}
              >
                <Icon name="add" size={16} color="#fff" />
                <Text style={styles.createBtnText}>Create</Text>
              </TouchableOpacity>
            </View>

            {qrPaymentsLoading ? (
              <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 20 }} />
            ) : filteredPayments.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="qr-code-outline" size={40} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No matching payments' : 'No QR payments yet'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery ? 'Try a different search term' : 'Tap "+ Create" to generate your first QR payment'}
                </Text>
              </View>
            ) : (
              filteredPayments.map(payment => (
                <QRPaymentCard
                  key={payment.id}
                  payment={payment}
                  colors={colors}
                  styles={styles}
                  onPress={() => handleCardPress(payment)}
                />
              ))
            )}
          </View>
        )}

        {/* When QR is not enabled */}
        {!canGenerateQR && (
          <View style={styles.disabledState}>
            <Icon name="qr-code-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.disabledTitle}>QR Payments Not Enabled</Text>
            <Text style={styles.disabledSubtext}>Contact your admin to enable QR payments for this shop.</Text>
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <OwnerProfileDropdown visible={showProfile} onClose={() => setShowProfile(false)} />
      <OwnerWalletModal visible={showWallet} onClose={() => setShowWallet(false)} />
      <CreateQRPaymentModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} />
      <QRPaymentDisplayModal
        visible={showQRDisplay}
        payment={selectedPayment}
        onClose={() => { setShowQRDisplay(false); setSelectedPayment(null); }}
      />
    </ScreenWrapper>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 32, height: 32, borderRadius: 16 },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.12)',
  },
  walletPillText: { fontSize: 12, fontWeight: '700', color: '#f97316' },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  profileInitial: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Search bar
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    padding: 0,
  },
  searchCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },

  // Scroll content
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 16 },

  // Total Collected Card
  totalCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  totalCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  totalCardLabel: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  totalCardAmount: { fontSize: 32, fontWeight: '900', color: colors.foreground, marginBottom: 4 },
  totalCardSub: { fontSize: 12, fontWeight: '500', color: '#10b981' },

  // Overview Card
  overviewCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  overviewTitle: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },

  // QR Payments Section
  qrSection: { marginTop: 4 },
  qrSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  qrSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qrSectionTitle: { fontSize: 17, fontWeight: '800', color: colors.foreground },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // QR Card
  qrCard: {
    backgroundColor: colors.muted,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrCardBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  qrTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6,182,212,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  qrTypeBadgeText: { fontSize: 9, fontWeight: '700', color: '#06b6d4' },
  statusBadgePaid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  paidBadgeText: { fontSize: 9, fontWeight: '700', color: '#22c55e' },
  qrCardTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground, marginBottom: 2 },
  qrCardAmount: { fontSize: 13, fontWeight: '500', color: colors.mutedForeground, marginBottom: 0 },
  payerSection: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  payerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  payerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  payerName: { fontSize: 13, fontWeight: '600', color: colors.foreground, flex: 1 },
  payerDate: { fontSize: 11, color: colors.mutedForeground },
  morePayersText: { fontSize: 11, color: colors.mutedForeground, marginTop: 4 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  emptySubtext: { fontSize: 12, color: colors.mutedForeground, textAlign: 'center' },

  // Disabled state (QR not enabled)
  disabledState: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  disabledTitle: { fontSize: 17, fontWeight: '700', color: colors.foreground },
  disabledSubtext: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: 40 },
});
