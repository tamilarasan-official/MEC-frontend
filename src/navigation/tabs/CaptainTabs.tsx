import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CaptainTabParamList } from '../../types';
import CaptainHomeScreen from '../../screens/captain/CaptainHomeScreen';
import CaptainHistoryScreen from '../../screens/captain/CaptainHistoryScreen';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';

const Tab = createBottomTabNavigator<CaptainTabParamList>();

export default function CaptainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={CaptainHomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={CaptainHistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'time' : 'time-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
