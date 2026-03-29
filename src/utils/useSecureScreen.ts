import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

const { SecureScreen } = NativeModules;

/**
 * Prevents screenshots and screen recording while the component is mounted.
 * Android only — uses FLAG_SECURE. No-op on iOS (handled by app-level config).
 */
export function useSecureScreen() {
  useEffect(() => {
    if (Platform.OS === 'android' && SecureScreen) {
      SecureScreen.enable();
      return () => SecureScreen.disable();
    }
  }, []);
}
