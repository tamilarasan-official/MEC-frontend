import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from '../common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppDispatch } from '../../store';
import { createQRPayment } from '../../store/slices/userSlice';

interface CreateQRPaymentModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CreateQRPaymentModal({ visible, onClose }: CreateQRPaymentModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const slideAnim = useMemo(() => new Animated.Value(600), []);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setAmount('');
      slideAnim.setValue(600);
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleSubmit = async () => {
    if (title.trim().length < 3) {
      return Alert.alert('Error', 'Title must be at least 3 characters');
    }
    if (description.trim().length < 10) {
      return Alert.alert('Error', 'Description must be at least 10 characters');
    }
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      return Alert.alert('Error', 'Please enter a valid amount');
    }
    if (amountNum > 100000) {
      return Alert.alert('Error', 'Amount cannot exceed Rs. 1,00,000');
    }

    setIsSubmitting(true);
    try {
      await dispatch(createQRPayment({
        title: title.trim(),
        description: description.trim(),
        amount: amountNum,
      })).unwrap();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', typeof err === 'string' ? err : 'Failed to create QR payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrapper}
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create QR Payment</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Canteen Payment"
              placeholderTextColor={colors.mutedForeground}
              maxLength={100}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what this payment is for (min 10 chars)"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Amount (Rs.)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              maxLength={6}
            />

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="qr-code-outline" size={18} color="#fff" />
                  <Text style={styles.submitText}>Generate QR Code</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: -4,
  },
  input: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
