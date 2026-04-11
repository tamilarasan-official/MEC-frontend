/**
 * Security Check Utility
 * Detects rooted/jailbroken devices and emulators.
 * Runs at app startup — if the device is compromised, the app warns or blocks.
 *
 * Fixes: H4 (root detection), H5 (tamper/emulator detection)
 */

import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';

export interface SecurityCheckResult {
  isRooted: boolean;
  isEmulator: boolean;
  isPinned: boolean; // true = device has screen lock set
  packageName: string;
}

const EXPECTED_PACKAGE_NAME = 'com.mec.campusone';

/**
 * Run all security checks. Call this at app startup (App.tsx or RootNavigator).
 * Returns a result object — the caller decides how to handle it (warn, block, log).
 */
export async function runSecurityChecks(): Promise<SecurityCheckResult> {
  const [isRooted, isEmulator, isPinned, packageName] = await Promise.all([
    checkRooted(),
    checkEmulator(),
    checkScreenLock(),
    DeviceInfo.getBundleId(),
  ]);

  return {
    isRooted,
    isEmulator,
    isPinned,
    packageName,
  };
}

/**
 * H4 — Root/jailbreak detection.
 * Uses react-native-device-info which checks for:
 * - Android: su binary, /system/xbin/su, Superuser.apk, BusyBox, /system writable
 * - iOS: Cydia.app, /etc/apt, /bin/bash, file write outside sandbox
 */
async function checkRooted(): Promise<boolean> {
  try {
    return await DeviceInfo.isRooted();
  } catch {
    return false;
  }
}

/**
 * H5 — Emulator/tamper detection.
 * Emulators are commonly used to run modified APKs with Frida or similar tools.
 */
async function checkEmulator(): Promise<boolean> {
  try {
    return await DeviceInfo.isEmulator();
  } catch {
    return false;
  }
}

/**
 * Check if the device has a screen lock (PIN/pattern/biometric).
 * A device with no screen lock is higher risk for physical access attacks.
 */
async function checkScreenLock(): Promise<boolean> {
  // react-native-device-info does not expose isPinOrFingerprintSet directly
  // This can be extended with @react-native-community/async-storage or native module
  // Returning true as default (assume locked) — add native check if needed
  return true;
}

/**
 * H5 — Package name tamper check.
 * If an attacker repackages the APK, they typically use a different package name.
 * This catches naive repacking but not sophisticated ones that preserve the package name.
 */
export function isPackageNameValid(packageName: string): boolean {
  return packageName === EXPECTED_PACKAGE_NAME;
}

/**
 * Determine if the app should block operation based on security checks.
 * Policy: block on rooted devices in production; warn on emulator.
 */
export function shouldBlockApp(result: SecurityCheckResult): boolean {
  if (__DEV__) return false; // Never block in dev builds

  if (!isPackageNameValid(result.packageName)) return true; // Repackaged APK
  if (result.isRooted) return true; // Rooted device

  return false;
}

/**
 * Determine if a warning should be shown (non-blocking concerns).
 */
export function shouldWarnUser(result: SecurityCheckResult): boolean {
  if (__DEV__) return false;
  return result.isEmulator;
}

/**
 * Platform-specific label for logging.
 */
export const PLATFORM = Platform.OS === 'android' ? 'Android' : 'iOS';
