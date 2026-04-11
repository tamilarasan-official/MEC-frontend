import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import Icon from './Icon';
import {
  requestLocationPermission,
  isLocationPermissionGranted,
  openLocationSettings,
} from '../../services/locationService';

interface LocationPermissionGateProps {
  onGranted: () => void;
}

export default function LocationPermissionGate({ onGranted }: LocationPermissionGateProps) {
  const [status, setStatus] = useState<'denied' | 'never_ask_again'>('denied');

  // Re-check permission on every foreground resume (user may have changed it in Settings)
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        const granted = await isLocationPermissionGranted();
        if (granted) onGranted();
      }
    });
    return () => sub.remove();
  }, [onGranted]);

  const handleRequest = useCallback(async () => {
    const result = await requestLocationPermission();
    if (result === 'granted') {
      onGranted();
    } else {
      setStatus(result);
    }
  }, [onGranted]);

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Icon name="location" size={40} color="#3b82f6" />
        </View>
        <Text style={styles.title}>Location Access Required</Text>
        <Text style={styles.message}>
          CampusOne needs your location while using the app for campus safety and services.
        </Text>
        {status === 'never_ask_again' ? (
          <TouchableOpacity style={styles.btn} onPress={openLocationSettings} activeOpacity={0.85}>
            <Icon name="settings-outline" size={18} color="#fff" />
            <Text style={styles.btnText}>Open Settings</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btn} onPress={handleRequest} activeOpacity={0.85}>
            <Icon name="location-outline" size={18} color="#fff" />
            <Text style={styles.btnText}>Allow Location</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99998,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1a1a2e',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
