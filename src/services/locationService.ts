import { PermissionsAndroid, Platform, AppState, AppStateStatus } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { getSocket } from './socketService';

let watchId: number | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let isTracking = false;
let lastEmitLat = 0;
let lastEmitLng = 0;

/** Minimum distance change (meters) before emitting a new update. */
const MIN_DISTANCE_M = 10;

/** Check if location permission is granted. */
export async function isLocationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const fine = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return fine;
    } catch (e) {
      if (__DEV__) console.warn('[Location] Permission check failed:', e);
      return false;
    }
  }
  return true;
}

/**
 * Request location permission from the user.
 * Returns 'granted' | 'denied' | 'never_ask_again'
 */
export async function requestLocationPermission(): Promise<'granted' | 'denied' | 'never_ask_again'> {
  if (Platform.OS === 'android') {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission Required',
          message:
            'CampusOne needs your location while using the app for campus safety and services.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'never_ask_again';
      return 'denied';
    } catch (e) {
      if (__DEV__) console.warn('[Location] Permission request failed:', e);
      return 'denied';
    }
  }
  return 'granted';
}

/**
 * Start watching location and emitting updates via Socket.IO.
 * Only emits when the user has moved >= MIN_DISTANCE_M from last emit.
 */
export function startLocationTracking(): void {
  if (isTracking) return;
  isTracking = true;
  startWatch();

  // Listen for foreground/background transitions
  appStateSubscription = AppState.addEventListener('change', handleAppState);
  if (__DEV__) console.log('[Location] Tracking started');
}

/** Stop tracking and clean up. */
export function stopLocationTracking(): void {
  isTracking = false;
  clearWatch();

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  // Notify backend that this user stopped
  const socket = getSocket();
  socket?.emit('location:stop');

  lastEmitLat = 0;
  lastEmitLng = 0;
  if (__DEV__) console.log('[Location] Tracking stopped');
}

/** Returns whether we are currently tracking. */
export function isCurrentlyTracking(): boolean {
  return isTracking;
}

// ── Internal helpers ───────────────────────────────────────────

function startWatch(): void {
  if (watchId !== null) return;

  // Get initial position immediately — don't wait for the interval/movement
  Geolocation.getCurrentPosition(
    (position: any) => { emitLocation(position); },
    (error: any) => {
      if (__DEV__) console.warn('[Location] Initial position error:', error.code, error.message);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
  );

  // Then watch for ongoing updates — use distanceFilter: 0 so we always
  // get callbacks at the interval even when stationary. Our emitLocation()
  // handles the distance dedup before sending to the server.
  watchId = Geolocation.watchPosition(
    (position: any) => {
      emitLocation(position);
    },
    (error: any) => {
      if (__DEV__) console.warn('[Location] Watch error:', error.code, error.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 0,
      interval: 15000,        // Android: desired interval (15s)
      fastestInterval: 10000, // Android: fastest acceptable interval
      showsBackgroundLocationIndicator: false,
    },
  );
}

function clearWatch(): void {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
  }
}

function emitLocation(position: any): void {
  const { latitude, longitude, accuracy } = position.coords;

  // Skip if user hasn't moved enough since last emit
  if (lastEmitLat !== 0 && lastEmitLng !== 0) {
    const dist = haversineMeters(lastEmitLat, lastEmitLng, latitude, longitude);
    if (dist < MIN_DISTANCE_M) return;
  }

  lastEmitLat = latitude;
  lastEmitLng = longitude;

  const socket = getSocket();
  if (socket?.connected) {
    socket.emit('location:update', {
      latitude,
      longitude,
      accuracy: accuracy ?? 0,
    });
  }
}

function handleAppState(nextState: AppStateStatus): void {
  if (!isTracking) return;

  if (nextState === 'active') {
    startWatch();
  } else if (nextState === 'background' || nextState === 'inactive') {
    clearWatch();
    const socket = getSocket();
    socket?.emit('location:stop');
  }
}

/** Quick haversine distance in meters. */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
