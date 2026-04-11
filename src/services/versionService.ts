/**
 * Version Service
 * Checks for app updates against the backend version config
 */

import axios from 'axios';
import { Platform } from 'react-native';
import Config from 'react-native-config';
import { API_ORIGIN } from './api';

// App version derived from package.json — single source of truth
const APP_VERSION: string = require('../../package.json').version;

// API key for mobile app verification — must be set in .env as APP_API_KEY
const APP_API_KEY = Config.APP_API_KEY as string;
if (!APP_API_KEY) {
  throw new Error('[Security] APP_API_KEY is not configured. Set APP_API_KEY in your .env file.');
}

export interface UpdateInfo {
  updateAvailable: boolean;
  forceUpdate: boolean;
  latestVersion: string;
  updateUrl: string;
}

/**
 * Compare two semver version strings
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

/**
 * Check if an app update is available
 * Calls the public version-check endpoint (no auth required)
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const response = await axios.get(
      `${API_ORIGIN}/api/v1/app/version-check?platform=${platform}`,
      {
        timeout: 10000,
        headers: {
          'X-App-Key': APP_API_KEY,
        },
      }
    );

    const data = response.data?.data;
    if (!data) return null;

    const { latestVersion, minVersion, forceUpdate, updateUrl } = data;

    // Check if current version is below minimum (force update)
    if (compareVersions(APP_VERSION, minVersion) < 0) {
      return {
        updateAvailable: true,
        forceUpdate: true,
        latestVersion,
        updateUrl,
      };
    }

    // Check if current version is below latest (soft update)
    if (compareVersions(APP_VERSION, latestVersion) < 0) {
      return {
        updateAvailable: true,
        forceUpdate: forceUpdate || false,
        latestVersion,
        updateUrl,
      };
    }

    // Up to date
    return null;
  } catch {
    // Version check is non-critical — silently fail
    if (__DEV__) {
      console.log('[VersionService] Version check failed (non-critical)');
    }
    return null;
  }
}

export function getCurrentVersion(): string {
  return APP_VERSION;
}
