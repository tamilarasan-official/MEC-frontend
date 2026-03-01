import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator,
  Platform, Vibration, Animated, Modal,
} from 'react-native';
import { Camera, useCameraDevice, useCodeScanner, CameraPermissionStatus } from 'react-native-vision-camera';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { ScannedOrderModal } from '../../components/common/ScannedOrderModal';
import { decodeQrData } from '../../utils/qrDecode';

interface CaptainScannerScreenProps {
  visible: boolean;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

export default function CaptainScannerScreen({ visible, onClose, onOrderUpdated }: CaptainScannerScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [permission, setPermission] = useState<CameraPermissionStatus | null>(null);
  const [scannedOrderId, setScannedOrderId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const scanCooldown = useRef(false);
  const lineAnim = useRef(new Animated.Value(0)).current;

  const device = useCameraDevice('back');

  useEffect(() => {
    if (visible) {
      (async () => {
        const status = await Camera.requestCameraPermission();
        setPermission(status);
      })();
      setIsActive(true);
      setScannedOrderId(null);
      setScanError(null);
      scanCooldown.current = false;
    }
  }, [visible]);

  // Scanning line animation
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lineAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(lineAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [lineAnim, visible]);

  const handleCodeScanned = useCallback((codes: { value?: string }[]) => {
    if (scanCooldown.current || !isActive) return;
    const raw = codes[0]?.value;
    if (!raw) return;

    scanCooldown.current = true;
    Vibration.vibrate(100);

    const orderId = decodeQrData(raw);
    if (orderId) {
      setScannedOrderId(orderId);
      setScanError(null);
      setIsActive(false);
    } else {
      setScanError('Invalid QR code. Please scan a valid order QR code.');
      setTimeout(() => {
        setScanError(null);
        scanCooldown.current = false;
      }, 2500);
    }
  }, [isActive]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: handleCodeScanned,
  });

  const handleModalClose = useCallback(() => {
    setScannedOrderId(null);
    setIsActive(true);
    scanCooldown.current = false;
  }, []);

  const handleActionComplete = useCallback(() => {
    onOrderUpdated?.();
  }, [onOrderUpdated]);

  const handleDismiss = useCallback(() => {
    setIsActive(false);
    setScannedOrderId(null);
    onClose();
  }, [onClose]);

  const translateY = lineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  const renderContent = () => {
    // Permission states
    if (permission === null) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.centerText}>Requesting camera access...</Text>
        </View>
      );
    }

    if (permission !== 'granted') {
      return (
        <View style={styles.centerContainer}>
          <View style={styles.errorCircle}>
            <Icon name="camera-outline" size={36} color="#ef4444" />
          </View>
          <Text style={styles.errorTitle}>Camera Access Required</Text>
          <Text style={styles.errorDesc}>
            Please allow camera access to scan QR codes for order processing.
          </Text>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}>
            <Icon name="settings-outline" size={18} color="#fff" />
            <Text style={styles.settingsBtnText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!device) {
      return (
        <View style={styles.centerContainer}>
          <Icon name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.errorTitle}>No Camera Found</Text>
          <Text style={styles.errorDesc}>Could not find a camera on this device.</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {/* Camera */}
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive && visible}
          codeScanner={codeScanner}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Top dim */}
          <View style={styles.overlayDim} />

          {/* Middle row with viewfinder */}
          <View style={styles.middleRow}>
            <View style={styles.overlayDimSide} />
            <View style={styles.viewfinder}>
              {/* Corners */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Scanning line */}
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY }] }]}
              />
            </View>
            <View style={styles.overlayDimSide} />
          </View>

          {/* Bottom dim with instructions */}
          <View style={[styles.overlayDim, styles.bottom]}>
            <View style={styles.instructions}>
              <Icon name="scan-outline" size={20} color="rgba(255,255,255,0.8)" />
              <Text style={styles.instructionText}>
                Scan student's order QR to process quickly
              </Text>
            </View>

            {/* Error message */}
            {scanError && (
              <View style={styles.errorBanner}>
                <Icon name="alert-circle" size={18} color="#ef4444" />
                <Text style={styles.errorBannerText}>{scanError}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Title bar */}
        <View style={styles.titleBar}>
          <TouchableOpacity style={styles.backBtn} onPress={handleDismiss} activeOpacity={0.7}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.titleText}>Scan Order QR</Text>
          <View style={styles.backBtn} />
        </View>

        {/* Scanned Order Modal */}
        {scannedOrderId && (
          <ScannedOrderModal
            orderId={scannedOrderId}
            onClose={handleModalClose}
            onActionComplete={handleActionComplete}
          />
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleDismiss}>
      {renderContent()}
    </Modal>
  );
}

const VIEWFINDER_SIZE = 250;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  centerText: {
    marginTop: 16,
    fontSize: 15,
    color: colors.textMuted,
  },
  errorCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  settingsBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  overlayDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayDimSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  middleRow: {
    flexDirection: 'row',
    height: VIEWFINDER_SIZE,
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#3b82f6',
  },
  cornerTL: {
    top: 0, left: 0,
    borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0, right: 0,
    borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0, left: 0,
    borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0, right: 0,
    borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8,
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  bottom: {
    alignItems: 'center',
    paddingTop: 30,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  instructionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.2)',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginHorizontal: 24,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#fca5a5',
    flex: 1,
  },
  titleBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});
