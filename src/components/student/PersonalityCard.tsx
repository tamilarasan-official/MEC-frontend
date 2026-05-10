import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StreakPersonality, PersonalityType } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import Icon from '../common/Icon';

interface Props {
  personality: StreakPersonality;
}

type GradientDef = { start: string; end: string; textColor: string; subColor: string };

const GRADIENTS: Record<PersonalityType, GradientDef> = {
  biriyani_boss:    { start: '#fef3c7', end: '#fde68a', textColor: '#78350f', subColor: '#92400e' },
  coffee_addict:    { start: '#fef9c3', end: '#fef08a', textColor: '#713f12', subColor: '#854d0e' },
  snack_monster:    { start: '#fff7ed', end: '#fed7aa', textColor: '#7c2d12', subColor: '#9a3412' },
  meal_planner:     { start: '#ecfdf5', end: '#a7f3d0', textColor: '#064e3b', subColor: '#065f46' },
  healthy_eater:    { start: '#f0fdf4', end: '#bbf7d0', textColor: '#14532d', subColor: '#166534' },
  night_owl:        { start: '#f5f3ff', end: '#ddd6fe', textColor: '#3b0764', subColor: '#4c1d95' },
  early_bird:       { start: '#fefce8', end: '#fef08a', textColor: '#713f12', subColor: '#92400e' },
  big_spender:      { start: '#fffbeb', end: '#fde68a', textColor: '#78350f', subColor: '#92400e' },
  loyal_regular:    { start: '#eff6ff', end: '#bfdbfe', textColor: '#1e3a5f', subColor: '#1e40af' },
  weekend_warrior:  { start: '#fdf4ff', end: '#e9d5ff', textColor: '#3b0764', subColor: '#6b21a8' },
};

const DARK_GRADIENTS: Record<PersonalityType, GradientDef> = {
  biriyani_boss:    { start: '#451a03', end: '#78350f', textColor: '#fef3c7', subColor: '#fde68a' },
  coffee_addict:    { start: '#422006', end: '#713f12', textColor: '#fef9c3', subColor: '#fef08a' },
  snack_monster:    { start: '#431407', end: '#7c2d12', textColor: '#fff7ed', subColor: '#fed7aa' },
  meal_planner:     { start: '#022c22', end: '#064e3b', textColor: '#d1fae5', subColor: '#a7f3d0' },
  healthy_eater:    { start: '#052e16', end: '#14532d', textColor: '#dcfce7', subColor: '#bbf7d0' },
  night_owl:        { start: '#2e1065', end: '#3b0764', textColor: '#ede9fe', subColor: '#ddd6fe' },
  early_bird:       { start: '#422006', end: '#713f12', textColor: '#fefce8', subColor: '#fef08a' },
  big_spender:      { start: '#451a03', end: '#78350f', textColor: '#fffbeb', subColor: '#fde68a' },
  loyal_regular:    { start: '#1e3a5f', end: '#1e40af', textColor: '#dbeafe', subColor: '#bfdbfe' },
  weekend_warrior:  { start: '#3b0764', end: '#6b21a8', textColor: '#fdf4ff', subColor: '#e9d5ff' },
};

function getPersonalityIcon(type: PersonalityType): string {
  switch (type) {
    case 'coffee_addict': return 'cafe-outline';
    case 'biriyani_boss': return 'restaurant-outline';
    case 'snack_monster': return 'fast-food-outline';
    case 'meal_planner': return 'calendar-outline';
    case 'healthy_eater': return 'leaf-outline';
    case 'night_owl': return 'moon-outline';
    case 'early_bird': return 'sunny-outline';
    case 'big_spender': return 'card-outline';
    case 'loyal_regular': return 'heart-outline';
    case 'weekend_warrior': return 'rocket-outline';
    default: return 'sparkles-outline';
  }
}

export default function PersonalityCard({ personality }: Props) {
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const grad = isDark ? DARK_GRADIENTS[personality.type] : GRADIENTS[personality.type];

  return (
    <LinearGradient
      colors={[grad.start, grad.end]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <View style={styles.iconWrap}>
        <Icon name={getPersonalityIcon(personality.type)} size={32} color={grad.textColor} />
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.label, { color: grad.textColor }]}>{personality.label}</Text>
        <Text style={[styles.flavour, { color: grad.subColor }]} numberOfLines={2}>
          {personality.flavourText}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  iconWrap: { width: 40, alignItems: 'center', justifyContent: 'center' },
  textBlock: { flex: 1 },
  label: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  flavour: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
});
