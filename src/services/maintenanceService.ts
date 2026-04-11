import axios from 'axios';
import Config from 'react-native-config';
import { API_ORIGIN } from './api';

const APP_API_KEY = Config.APP_API_KEY || '272183449088151d1938eca9e9de6cd2cb7a7001ad073cc050352117c1b52ca3';

export interface MaintenanceInfo {
  maintenanceEnabled: boolean;
  message: string;
  estimatedDuration: number;
  startedAt: string | null;
}

export async function checkMaintenance(): Promise<MaintenanceInfo | null> {
  try {
    const response = await axios.get(`${API_ORIGIN}/api/v1/app/maintenance-status`, {
      timeout: 10000,
      headers: {
        'X-App-Key': APP_API_KEY,
      },
    });

    const data = response.data?.data;
    if (!data?.maintenanceEnabled) return null;

    return {
      maintenanceEnabled: true,
      message: data.message || 'App is under maintenance',
      estimatedDuration: data.estimatedDuration || 1,
      startedAt: data.startedAt || null,
    };
  } catch {
    if (__DEV__) {
      console.log('[MaintenanceService] Check failed');
    }
    return null;
  }
}
