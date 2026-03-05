/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { handleBackgroundMessage } from './src/services/notificationService';

// Register FCM background message handler (MUST be before AppRegistry)
try {
  setBackgroundMessageHandler(getMessaging(), handleBackgroundMessage);
} catch (e) {
  // Firebase messaging not available — app continues without push notifications
}

// Register Notifee background event handler
try {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      // Notification was pressed in background — app will open to the last screen
      // Deep linking to specific screens requires navigation ref which isn't available in headless JS
      if (__DEV__) {
        console.log('[Notifee] Background press:', detail.notification?.data);
      }
    }
  });
} catch (e) {
  // Notifee not available — app continues without local notification handling
}

AppRegistry.registerComponent(appName, () => App);
