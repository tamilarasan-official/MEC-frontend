import React from 'react';
import { StatusBar, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** StatusBar style override; auto-detected from theme when omitted */
  barStyle?: 'light-content' | 'dark-content';
  /** StatusBar background override; defaults to theme background */
  statusBarColor?: string;
  /** SafeArea edges to respect, defaults to ['top', 'left', 'right'] */
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
}

export default function ScreenWrapper({
  children,
  style,
  barStyle,
  statusBarColor,
  edges = ['top', 'left', 'right'],
}: ScreenWrapperProps) {
  const { colors, isDark } = useTheme();
  const resolvedBarStyle = barStyle ?? (isDark ? 'light-content' : 'dark-content');
  const resolvedBg = statusBarColor ?? colors.background;

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.background }, style]} edges={edges}>
      <StatusBar barStyle={resolvedBarStyle} backgroundColor={resolvedBg} translucent={false} />
      {children}
    </SafeAreaView>
  );
}
