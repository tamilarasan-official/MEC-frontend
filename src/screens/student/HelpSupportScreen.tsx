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

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'HelpSupport'>;

interface FAQ {
  question: string;
  answer: string;
}

const FAQS: FAQ[] = [
  {
    question: 'How do I add money to my wallet?',
    answer: 'Visit the accountant office with cash to add money to your wallet. The balance will be updated instantly.',
  },
  {
    question: 'Can I cancel my order?',
    answer: 'Orders cannot be cancelled once placed. Please contact the canteen staff if you have any issues.',
  },
  {
    question: 'How do I collect my order?',
    answer: "Once your order is ready, you'll receive a notification. Show your pickup token at the counter to collect your order.",
  },
];

export default function HelpSupportScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>GET HELP</Text>

          {/* Contact Support */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => Linking.openURL('mailto:campusone@madrascollege.ac.in').catch(() => {})}
            activeOpacity={0.7}
            accessibilityLabel="Contact Support"
            accessibilityRole="button">
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.accentBg }]}>
                <Icon name="call" size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Contact Support</Text>
                <Text style={styles.menuSub}>campusone@madrascollege.ac.in</Text>
              </View>
            </View>
            <Icon name="open-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>FREQUENTLY ASKED QUESTIONS</Text>

          {/* FAQs */}
          {FAQS.map((faq, idx) => (
            <View key={idx} style={styles.faqCard}>
              <Text style={styles.faqQuestionText}>{faq.question}</Text>
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            </View>
          ))}

          {/* Visit Support Portal */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => Linking.openURL('https://campusonesupport.madrascollege.ac.in').catch(() => {})}
            activeOpacity={0.7}
            accessibilityLabel="Visit Support Portal"
            accessibilityRole="button">
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.primaryBg }]}>
                <Icon name="globe-outline" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Visit Support Portal</Text>
                <Text style={styles.menuSub}>campusonesupport.madrascollege.ac.in</Text>
              </View>
            </View>
            <Icon name="open-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Need More Help */}
          <View style={styles.helpCard}>
            <View style={styles.helpIcon}>
              <Icon name="help-circle" size={22} color={colors.primary} />
            </View>
            <View style={styles.helpInfo}>
              <Text style={styles.helpTitle}>Need more help?</Text>
              <Text style={styles.helpSub}>Visit the MEC Admin Office during working hours</Text>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
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

  faqCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 10,
  },
  faqQuestionText: { fontSize: 14, fontWeight: '600', color: c.text },
  faqAnswer: {
    fontSize: 13, color: c.textSecondary, lineHeight: 20, marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border,
  },

  helpCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.primaryBg, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.primaryBorder, marginTop: 8,
  },
  helpIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(16,185,129,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  helpInfo: { flex: 1 },
  helpTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  helpSub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  headerSpacer: { width: 36 },
  sectionLabelSpaced: { marginTop: 24 },
  bottomSpacer: { height: 40 },
});
