import { Platform, PermissionsAndroid, AppState, AppStateStatus, Linking } from 'react-native';
import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import { getSocket } from './socketService';

let watchId: number | null = null;
let lastLat = 0;
let lastLng = 0;
let appStateSubscription: { remove: () => void } | null = null;

// Haversine: distance in meters between two lat/lng points
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function emitLocation(position: GeoPosition): void {
  const { latitude, longitude, accuracy } = position.coords;

  // Only emit if user moved 10+ meters
  if (lastLat !== 0 && lastLng !== 0) {
    const dist = haversineMeters(lastLat, lastLng, latitude, longitude);
    if (dist < 10) return;
  }

  lastLat = latitude;
  lastLng = longitude;

  const socket = getSocket();
  if (socket?.connected) {
    socket.emit('location:update', { latitude, longitude, accuracy });
    if (__DEV__) console.log('[Location] Emitted:', latitude.toFixed(5), longitude.toFixed(5));
  }
}

export async function isLocationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return granted;
  }
  // iOS: try to get current position — if it works, permission is granted
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      () => resolve(true),
      (error) => {
        // Error code 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE
        resolve(error.code !== 1);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
  });
}

export async function requestLocationPermission(): Promise<'granted' | 'denied' | 'never_ask_again'> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'CampusOne needs your location while using the app for campus safety and services.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'never_ask_again';
    return 'denied';
  }
  // iOS: requestAuthorization is triggered by getCurrentPosition
  return new Promise((resolve) => {
    Geolocation.requestAuthorization('whenInUse');
    // Give iOS time to show the permission dialog
    setTimeout(() => {
      Geolocation.getCurrentPosition(
        () => resolve('granted'),
        (error) => resolve(error.code === 1 ? 'denied' : 'granted'),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    }, 1000);
  });
}

export function openLocationSettings(): void {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings().catch(() => {});
  }
}

export function startLocationTracking(): void {
  if (watchId !== null) return;

  // Get an immediate position first (no waiting for movement)
  Geolocation.getCurrentPosition(
    emitLocation,
    (error) => {
      if (__DEV__) console.warn('[Location] getCurrentPosition error:', error.message);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
  );

  // Start watching for continuous updates
  watchId = Geolocation.watchPosition(
    emitLocation,
    (error) => {
      if (__DEV__) console.warn('[Location] watchPosition error:', error.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 0,
      interval: 15000,
      fastestInterval: 10000,
      showsBackgroundLocationIndicator: false,
    },
  );

  if (__DEV__) console.log('[Location] Tracking started, watchId:', watchId);
}

export function stopLocationTracking(): void {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
  }
  const socket = getSocket();
  if (socket?.connected) {
    socket.emit('location:stop');
  }
  lastLat = 0;
  lastLng = 0;
  if (__DEV__) console.log('[Location] Tracking stopped');
}

export function setupLocationLifecycle(): () => void {
  let wasTracking = false;

  const handleAppState = (state: AppStateStatus) => {
    if (state === 'active' && wasTracking) {
      startLocationTracking();
      wasTracking = false;
    } else if (state === 'background' && watchId !== null) {
      wasTracking = true;
      Geolocation.clearWatch(watchId);
      watchId = null;
    }
  };

  appStateSubscription = AppState.addEventListener('change', handleAppState);

  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
    stopLocationTracking();
  };
}
