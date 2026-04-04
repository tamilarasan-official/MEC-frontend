import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Animated, StatusBar } from 'react-native';
import Icon from './Icon';

interface Props {
  permissionStatus: 'denied' | 'never_ask_again';
  onRequestPermission: () => void;
}

/**
 * Full-screen blocker shown when location permission is not granted.
 * Prevents the user from using the app until they allow location access.
 */
export default function LocationPermissionGate({ permissionStatus, onRequestPermission }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    Animated.stagger(200, [
      Animated.spring(iconScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    return () => { StatusBar.setBarStyle('default'); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPermanentlyDenied = permissionStatus === 'never_ask_again';

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
        <View style={styles.iconCircle}>
          <Icon name="location-outline" size={48} color="#fff" />
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.title}>Location Required</Text>
        <Text style={styles.message}>
          CampusOne needs your location while using the app for campus safety and services.
        </Text>
        <Text style={styles.submessage}>
          Your location is only tracked while the app is open. It is not tracked in the background.
        </Text>

        {isPermanentlyDenied ? (
          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.85}
            onPress={() => Linking.openSettings()}
          >
            <Icon name="settings-outline" size={18} color="#3b82f6" />
            <Text style={styles.btnText}>Open Settings</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.85}
            onPress={onRequestPermission}
          >
            <Icon name="locate-outline" size={18} color="#3b82f6" />
            <Text style={styles.btnText}>Grant Permission</Text>
          </TouchableOpacity>
        )}

        {isPermanentlyDenied && (
          <Text style={styles.hint}>
            Go to App Settings &gt; Permissions &gt; Location &gt; Allow while using the app
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99998,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconWrap: { marginBottom: 28 },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(59,130,246,0.25)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(59,130,246,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  submessage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 18,
    alignSelf: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
