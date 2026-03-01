/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { handleBackgroundMessage } from './src/services/notificationService';

// Register FCM background message handler (MUST be before AppRegistry)
messaging().setBackgroundMessageHandler(handleBackgroundMessage);

// Register Notifee background event handler
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    console.log('[Notifee] Background press:', detail.notification?.data);
  }
});

AppRegistry.registerComponent(appName, () => App);
