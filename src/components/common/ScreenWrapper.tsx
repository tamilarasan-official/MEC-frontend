import React from 'react';
import { StatusBar, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** StatusBar style, defaults to 'dark-content' */
  barStyle?: 'light-content' | 'dark-content';
  /** StatusBar background, defaults to colors.background */
  statusBarColor?: string;
  /** SafeArea edges to respect, defaults to ['top', 'left', 'right'] */
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
}

export default function ScreenWrapper({
  children,
  style,
  barStyle = 'dark-content',
  statusBarColor = colors.background,
  edges = ['top', 'left', 'right'],
}: ScreenWrapperProps) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      <StatusBar barStyle={barStyle} backgroundColor={statusBarColor} translucent={false} />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
