import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { OwnerTabParamList } from '../../types';
import OwnerHomeScreen from '../../screens/owner/OwnerHomeScreen';
import OwnerOrdersScreen from '../../screens/owner/OwnerOrdersScreen';
import OwnerMenuScreen from '../../screens/owner/OwnerMenuScreen';
import OwnerSettingsScreen from '../../screens/owner/OwnerSettingsScreen';
import Icon from '../../components/common/Icon';
import { colors } from '../../theme/colors';

const Tab = createBottomTabNavigator<OwnerTabParamList>();

export default function OwnerTabs() {
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
        component={OwnerHomeScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OwnerOrdersScreen}
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Menu"
        component={OwnerMenuScreen}
        options={{
          tabBarLabel: 'Menu',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'restaurant' : 'restaurant-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={OwnerSettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
