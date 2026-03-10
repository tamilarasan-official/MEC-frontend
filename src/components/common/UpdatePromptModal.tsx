import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

interface UpdatePromptModalProps {
  visible: boolean;
  forceUpdate: boolean;
  latestVersion: string;
  updateUrl: string;
  onDismiss: () => void;
}

export function UpdatePromptModal({
  visible,
  forceUpdate,
  latestVersion,
  updateUrl,
  onDismiss,
}: UpdatePromptModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleUpdate = () => {
    Linking.openURL(updateUrl).catch(() => {
      // Failed to open URL — user can try manually
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={forceUpdate ? undefined : onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>{'🚀'}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {forceUpdate ? 'Update Required' : 'Update Available'}
          </Text>

          {/* Message */}
          <Text style={styles.message}>
            {forceUpdate
              ? `A critical update (v${latestVersion}) is required to continue using CampusOne. Please update now.`
              : `A new version (v${latestVersion}) of CampusOne is available with improvements and bug fixes.`}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {!forceUpdate && (
              <TouchableOpacity
                style={styles.laterButton}
                onPress={onDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.laterButtonText}>Later</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.updateButton, forceUpdate && styles.updateButtonFull]}
              onPress={handleUpdate}
              activeOpacity={0.7}
            >
              <Text style={styles.updateButtonText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    container: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 28,
      width: '100%',
      maxWidth: 340,
      alignItems: 'center',
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accent + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    iconText: {
      fontSize: 28,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    laterButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.border,
      alignItems: 'center',
    },
    laterButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    updateButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
    },
    updateButtonFull: {
      flex: undefined,
      width: '100%',
    },
    updateButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
