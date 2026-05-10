import { Platform } from 'react-native';
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';

/**
 * Native haptic feedback using the Taptic Engine (iOS) and
 * HapticFeedbackConstants (Android). Feels premium and precise —
 * unlike the old Vibration API which produced a harsh buzz.
 *
 * Falls back to vibration on devices without a haptic engine.
 */

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

/** Light tap — for selections, toggles, minor actions */
export function lightHaptic() {
  ReactNativeHapticFeedback.trigger('impactLight', options);
}

/** Medium tap — for button presses, confirmations */
export function mediumHaptic() {
  ReactNativeHapticFeedback.trigger('impactMedium', options);
}

/** Success haptic — for completed actions */
export function successHaptic() {
  ReactNativeHapticFeedback.trigger('notificationSuccess', options);
}

/** Error haptic — for failed actions */
export function errorHaptic() {
  ReactNativeHapticFeedback.trigger('notificationError', options);
}
