// MadrasOne - Enhanced Color Palette
// Light & Dark palettes sharing the same shape

const basePalette = {
  // Primary colors (emerald) – same in both themes
  primary: '#10b981',
  primaryLight: '#34d399',
  primaryDark: '#059669',
  primaryForeground: '#ffffff',

  // Emerald/Teal
  emerald500: '#10b981',
  emerald400: '#34d399',
  teal500: '#14b8a6',
  teal400: '#2dd4bf',

  // Violet
  violet500: '#8b5cf6',
  violet600: '#7c3aed',

  // Status colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  destructive: '#ef4444',
  danger: '#ef4444',

  // Accent / Blue
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  accent: '#3b82f6',

  // Orange
  orange400: '#fb923c',
  orange500: '#f97316',

  // Yellow
  yellow400: '#facc15',
  yellow500: '#eab308',

  // Green
  green500: '#22c55e',

  // Amber
  amber600: '#d97706',

  // Slate
  slate400: '#94a3b8',

  transparent: 'transparent',
  white: '#ffffff',
  black: '#000000',
};

// ─── Light palette ───────────────────────────────────────────
export const lightColors = {
  ...basePalette,

  // Gray scale
  gray: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827' },
  red:    { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626' },
  amber:  { 50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706' },
  blue:   { 50: '#eff6ff', 100: '#dbeafe', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb' },
  orange: { 50: '#fff7ed', 100: '#ffedd5', 400: '#fb923c', 500: '#f97316', 600: '#ea580c' },
  purple: { 50: '#faf5ff', 100: '#f3e8ff', 500: '#a855f7', 600: '#9333ea' },

  background: '#ffffff',
  backgroundAlt: '#f9fafb',
  card: '#ffffff',
  cardAlt: 'rgba(255, 255, 255, 0.5)',
  foreground: '#111827',
  mutedForeground: '#6b7280',
  border: '#e5e7eb',
  borderLight: 'rgba(229, 231, 235, 0.5)',

  successBg: 'rgba(34, 197, 94, 0.1)',
  warningBg: 'rgba(245, 158, 11, 0.1)',
  errorBg: 'rgba(239, 68, 68, 0.1)',
  blueBg: 'rgba(59, 130, 246, 0.1)',
  orangeBg: 'rgba(249, 115, 22, 0.1)',
  greenBg: 'rgba(34, 197, 94, 0.1)',
  violetBg: 'rgba(139, 92, 246, 0.1)',
  slateBg: 'rgba(148, 163, 184, 0.1)',
  amberBg: 'rgba(217, 119, 6, 0.1)',

  // Primary accent backgrounds
  primaryBg: 'rgba(16, 185, 129, 0.1)',
  primaryBorder: 'rgba(16, 185, 129, 0.2)',
  accentBg: 'rgba(59, 130, 246, 0.1)',
  accentBorder: 'rgba(59, 130, 246, 0.2)',

  muted: '#f3f4f6',
  secondary: '#f3f4f6',
  surface: '#f3f4f6',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',
  glassWhite: 'rgba(255, 255, 255, 0.2)',
  glassWhiteLight: 'rgba(255, 255, 255, 0.1)',
  glassBlack: 'rgba(0, 0, 0, 0.1)',

  revenueGradientStart: 'rgba(16, 185, 129, 0.2)',
  revenueGradientEnd: 'rgba(16, 185, 129, 0.05)',
  profitGradientStart: 'rgba(139, 92, 246, 0.2)',
  profitGradientEnd: 'rgba(139, 92, 246, 0.05)',

  text: '#111827',
  textMuted: '#6b7280',
  textSecondary: '#6b7280',
};

// ─── Dark palette ────────────────────────────────────────────
export const darkColors: ThemeColors = {
  ...basePalette,

  gray: { 50: '#1a1a2e', 100: '#16162a', 200: '#1e1e2a', 300: '#2a2a3e', 400: '#6b6b7e', 500: '#8b8b9e', 600: '#a0a0b2', 700: '#c0c0d0', 800: '#e0e0e8', 900: '#f0f0f5' },
  red:    { 50: '#2a1515', 100: '#331a1a', 500: '#ef4444', 600: '#dc2626' },
  amber:  { 50: '#2a2410', 100: '#332b14', 500: '#f59e0b', 600: '#d97706' },
  blue:   { 50: '#101828', 100: '#162040', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb' },
  orange: { 50: '#2a1c10', 100: '#332214', 400: '#fb923c', 500: '#f97316', 600: '#ea580c' },
  purple: { 50: '#1e1530', 100: '#261a3d', 500: '#a855f7', 600: '#9333ea' },

  background: '#0a0a0f',
  backgroundAlt: '#111118',
  card: '#111118',
  cardAlt: 'rgba(17, 17, 24, 0.5)',
  foreground: '#f0f0f5',
  mutedForeground: '#8b8b9e',
  border: '#1e1e2a',
  borderLight: 'rgba(30, 30, 42, 0.5)',

  successBg: 'rgba(34, 197, 94, 0.15)',
  warningBg: 'rgba(245, 158, 11, 0.15)',
  errorBg: 'rgba(239, 68, 68, 0.15)',
  blueBg: 'rgba(59, 130, 246, 0.15)',
  orangeBg: 'rgba(249, 115, 22, 0.15)',
  greenBg: 'rgba(34, 197, 94, 0.15)',
  violetBg: 'rgba(139, 92, 246, 0.15)',
  slateBg: 'rgba(148, 163, 184, 0.15)',
  amberBg: 'rgba(217, 119, 6, 0.15)',

  primaryBg: 'rgba(16, 185, 129, 0.12)',
  primaryBorder: 'rgba(16, 185, 129, 0.25)',
  accentBg: 'rgba(59, 130, 246, 0.12)',
  accentBorder: 'rgba(59, 130, 246, 0.3)',

  muted: '#1e1e2a',
  secondary: '#1e1e2a',
  surface: '#111118',
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  glassWhite: 'rgba(255, 255, 255, 0.08)',
  glassWhiteLight: 'rgba(255, 255, 255, 0.04)',
  glassBlack: 'rgba(0, 0, 0, 0.3)',

  revenueGradientStart: 'rgba(16, 185, 129, 0.25)',
  revenueGradientEnd: 'rgba(16, 185, 129, 0.08)',
  profitGradientStart: 'rgba(139, 92, 246, 0.25)',
  profitGradientEnd: 'rgba(139, 92, 246, 0.08)',

  text: '#f0f0f5',
  textMuted: '#8b8b9e',
  textSecondary: '#8b8b9e',
};

// Export type from lightColors shape
export type ThemeColors = typeof lightColors;

// Backward-compatible default export (light palette)
export const colors = lightColors;

// Status color mapping (works for both themes – text colors are saturated enough)
export const statusColors: Record<string, { text: string; bg: string; label: string }> = {
  pending: { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Pending' },
  preparing: { text: '#60a5fa', bg: 'rgba(59,130,246,0.12)', label: 'Preparing' },
  ready: { text: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'Ready' },
  partially_delivered: { text: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: 'Partial' },
  completed: { text: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Completed' },
  cancelled: { text: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Cancelled' },
};

export default colors;
