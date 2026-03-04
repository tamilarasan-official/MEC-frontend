import { Platform, Vibration } from 'react-native';

/**
 * Lightweight haptic feedback using React Native's built-in Vibration API.
 * On iOS, short vibrations feel like haptic taps.
 * On Android, uses pattern-based vibrations for similar effect.
 */

/** Light tap — for selections, toggles, minor actions */
export function lightHaptic() {
  if (Platform.OS === 'ios') {
    Vibration.vibrate(1);
  } else {
    Vibration.vibrate(10);
  }
}

/** Medium tap — for button presses, confirmations */
export function mediumHaptic() {
  if (Platform.OS === 'ios') {
    Vibration.vibrate(5);
  } else {
    Vibration.vibrate(20);
  }
}

/** Success haptic — for completed actions */
export function successHaptic() {
  if (Platform.OS === 'ios') {
    Vibration.vibrate([0, 10, 50, 10]);
  } else {
    Vibration.vibrate([0, 15, 60, 15]);
  }
}

/** Error haptic — for failed actions */
export function errorHaptic() {
  if (Platform.OS === 'ios') {
    Vibration.vibrate([0, 20, 40, 20, 40, 20]);
  } else {
    Vibration.vibrate([0, 30, 50, 30, 50, 30]);
  }
}
