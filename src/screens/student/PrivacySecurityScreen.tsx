import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StudentHomeStackParamList } from '../../types';
import Icon from '../../components/common/Icon';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'PrivacySecurity'>;

export default function PrivacySecurityScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy & Security</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>LEGAL</Text>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => Linking.openURL('https://madrasone.com/privacy')}
            activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.accentBg }]}>
                <Icon name="document-text" size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Privacy Policy</Text>
                <Text style={styles.menuSub}>How we handle your data</Text>
              </View>
            </View>
            <Icon name="open-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Terms of Service */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => Linking.openURL('https://madrasone.com/terms')}
            activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.orangeBg }]}>
                <Icon name="document-text" size={18} color={colors.orange500} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Terms of Service</Text>
                <Text style={styles.menuSub}>Our terms and conditions</Text>
              </View>
            </View>
            <Icon name="open-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Security Notice */}
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              Your data is securely stored and encrypted. We never share your personal information with third parties without your consent.
            </Text>
          </View>

          <View style={{ height: 40 }} />
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

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: c.textSecondary,
    letterSpacing: 1, marginBottom: 12,
  },

  menuCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 10,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  menuIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  menuTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  menuSub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },

  noticeCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginTop: 16,
  },
  noticeText: { fontSize: 13, color: c.textSecondary, lineHeight: 20 },
});
