// MadrasOne - Enhanced Color Palette
// Matching web app design system

export const colors = {
  // Primary colors (emerald)
  primary: '#10b981',
  primaryLight: '#34d399',
  primaryDark: '#059669',
  primaryForeground: '#ffffff',

  // Gray scale
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // Red scale
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
  },

  // Amber scale
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
  },

  // Blue scale
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
  },

  // Orange scale
  orange: {
    50: '#fff7ed',
    100: '#ffedd5',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
  },

  // Purple scale
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    500: '#a855f7',
    600: '#9333ea',
  },

  // Emerald/Teal
  emerald500: '#10b981',
  emerald400: '#34d399',
  teal500: '#14b8a6',
  teal400: '#2dd4bf',

  // Violet
  violet500: '#8b5cf6',
  violet600: '#7c3aed',
  violetBg: 'rgba(139, 92, 246, 0.1)',

  // Background colors
  background: '#ffffff',
  backgroundAlt: '#f9fafb',

  // Card colors
  card: '#ffffff',
  cardAlt: 'rgba(255, 255, 255, 0.5)',

  // Text colors
  foreground: '#111827',
  mutedForeground: '#6b7280',

  // Border colors
  border: '#e5e7eb',
  borderLight: 'rgba(229, 231, 235, 0.5)',

  // Status colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  destructive: '#ef4444',

  // Status badge backgrounds
  successBg: 'rgba(34, 197, 94, 0.1)',
  warningBg: 'rgba(245, 158, 11, 0.1)',
  errorBg: 'rgba(239, 68, 68, 0.1)',

  // Blue accent
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blueBg: 'rgba(59, 130, 246, 0.1)',

  // Orange accent
  orange400: '#fb923c',
  orange500: '#f97316',
  orangeBg: 'rgba(249, 115, 22, 0.1)',

  // Yellow accent
  yellow400: '#facc15',
  yellow500: '#eab308',

  // Green
  green500: '#22c55e',
  greenBg: 'rgba(34, 197, 94, 0.1)',

  // Muted/Secondary
  muted: '#f3f4f6',
  secondary: '#f3f4f6',

  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',

  // Glass morphism
  glassWhite: 'rgba(255, 255, 255, 0.2)',
  glassWhiteLight: 'rgba(255, 255, 255, 0.1)',
  glassBlack: 'rgba(0, 0, 0, 0.1)',

  // Slate (medals)
  slate400: '#94a3b8',
  slateBg: 'rgba(148, 163, 184, 0.1)',

  // Amber/Bronze
  amber600: '#d97706',
  amberBg: 'rgba(217, 119, 6, 0.1)',

  // Revenue gradient colors
  revenueGradientStart: 'rgba(16, 185, 129, 0.2)',
  revenueGradientEnd: 'rgba(16, 185, 129, 0.05)',
  profitGradientStart: 'rgba(139, 92, 246, 0.2)',
  profitGradientEnd: 'rgba(139, 92, 246, 0.05)',

  // Transparent
  transparent: 'transparent',
  white: '#ffffff',
  black: '#000000',

  // Aliases used across screens
  text: '#111827',
  textMuted: '#6b7280',
  textSecondary: '#6b7280',
  danger: '#ef4444',
  surface: '#f3f4f6',
};

// Status color mapping
export const statusColors: Record<string, { text: string; bg: string; label: string }> = {
  pending: { text: colors.amber[500], bg: colors.warningBg, label: 'Pending' },
  preparing: { text: colors.blue[400], bg: colors.blueBg, label: 'Preparing' },
  ready: { text: colors.orange[500], bg: colors.orangeBg, label: 'Ready' },
  partially_delivered: { text: colors.blue[500], bg: colors.blueBg, label: 'Partial' },
  completed: { text: colors.primary, bg: colors.successBg, label: 'Completed' },
  cancelled: { text: colors.destructive, bg: colors.errorBg, label: 'Cancelled' },
};

export default colors;
