import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StudentHomeStackParamList } from '../../types';
import DashboardScreen from '../../screens/student/DashboardScreen';
import MenuScreen from '../../screens/student/MenuScreen';
import StationeryScreen from '../../screens/student/StationeryScreen';
import OffersScreen from '../../screens/student/OffersScreen';
import CartScreen from '../../screens/student/CartScreen';
import OrderHistoryScreen from '../../screens/student/OrderHistoryScreen';
import LeaderboardScreen from '../../screens/student/LeaderboardScreen';
import ProfileScreen from '../../screens/student/ProfileScreen';
import NotificationsScreen from '../../screens/student/NotificationsScreen';
import NotificationSettingsScreen from '../../screens/student/NotificationSettingsScreen';
import PrivacySecurityScreen from '../../screens/student/PrivacySecurityScreen';
import HelpSupportScreen from '../../screens/student/HelpSupportScreen';
import WalletScreen from '../../screens/student/WalletScreen';

const Stack = createNativeStackNavigator<StudentHomeStackParamList>();

export default function StudentHomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen name="Stationery" component={StationeryScreen} />
      <Stack.Screen name="Offers" component={OffersScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
    </Stack.Navigator>
  );
}
