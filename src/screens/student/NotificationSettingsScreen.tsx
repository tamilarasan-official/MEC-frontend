import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList } from '../../types';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'NotificationSettings'>;

interface NotifPref {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  enabled: boolean;
}

const PREFS_INITIAL: NotifPref[] = [
  {
    key: 'orderUpdates', title: 'Order Updates',
    subtitle: 'Get notified when your order status changes',
    icon: 'notifications', iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.12)',
    enabled: true,
  },
  {
    key: 'promotions', title: 'Promotions & Offers',
    subtitle: 'Receive special deals and discount alerts',
    icon: 'pricetag', iconColor: '#a855f7', iconBg: 'rgba(168,85,247,0.12)',
    enabled: false,
  },
  {
    key: 'walletAlerts', title: 'Wallet Alerts',
    subtitle: 'Low balance and transaction notifications',
    icon: 'wallet', iconColor: '#10b981', iconBg: 'rgba(16,185,129,0.12)',
    enabled: true,
  },
  {
    key: 'newFeatures', title: 'New Features',
    subtitle: 'Be the first to know about app updates',
    icon: 'sparkles', iconColor: '#f59e0b', iconBg: 'rgba(245,158,11,0.12)',
    enabled: true,
  },
];

export default function NotificationSettingsScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [prefs, setPrefs] = useState<NotifPref[]>(PREFS_INITIAL);

  const togglePref = (key: string) => {
    setPrefs(prev =>
      prev.map(p => p.key === key ? { ...p, enabled: !p.enabled } : p),
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.description}>Choose which notifications you'd like to receive</Text>

          {prefs.map(pref => (
            <View key={pref.key} style={styles.prefCard}>
              <View style={styles.prefLeft}>
                <View style={[styles.prefIcon, { backgroundColor: pref.iconBg }]}>
                  <Icon name={pref.icon} size={18} color={pref.iconColor} />
                </View>
                <View style={styles.prefInfo}>
                  <Text style={styles.prefTitle}>{pref.title}</Text>
                  <Text style={styles.prefSub}>{pref.subtitle}</Text>
                </View>
              </View>
              <Switch
                value={pref.enabled}
                onValueChange={() => togglePref(pref.key)}
                trackColor={{ false: isDark ? '#2a2a3a' : '#e0e0e0', true: 'rgba(59,130,246,0.4)' }}
                thumbColor={pref.enabled ? colors.accent : (isDark ? '#555' : '#ccc')}
              />
            </View>
          ))}

          {/* Quiet Hours */}
          <View style={[styles.prefCard, { opacity: 0.6 }]}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIcon, { backgroundColor: 'rgba(107,114,128,0.12)' }]}>
                <Icon name="moon-outline" size={18} color="#6b7280" />
              </View>
              <View style={styles.prefInfo}>
                <Text style={styles.prefTitle}>Quiet Hours</Text>
                <Text style={styles.prefSub}>Coming soon - Set times when notifications are silenced</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  content: { padding: 16 },
  description: { fontSize: 13, color: c.textSecondary, marginBottom: 16 },

  prefCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 10,
  },
  prefLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  prefIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  prefInfo: { flex: 1 },
  prefTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  prefSub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
});
