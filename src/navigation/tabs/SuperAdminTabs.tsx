import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SuperAdminTabParamList } from '../../types';
import SADashboardScreen from '../../screens/superadmin/SADashboardScreen';
import SAUsersScreen from '../../screens/superadmin/SAUsersScreen';
import SAShopsScreen from '../../screens/superadmin/SAShopsScreen';
import SAPaymentsScreen from '../../screens/superadmin/SAPaymentsScreen';
import SAAnalyticsScreen from '../../screens/superadmin/SAAnalyticsScreen';
import SASettingsScreen from '../../screens/superadmin/SASettingsScreen';
import { Icon } from '../../components/common/Icon';
import { colors } from '../../theme/colors';

const Tab = createBottomTabNavigator<SuperAdminTabParamList>();

export default function SuperAdminTabs() {
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
        name="Dashboard"
        component={SADashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Users"
        component={SAUsersScreen}
        options={{
          tabBarLabel: 'Users',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'people' : 'people-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Shops"
        component={SAShopsScreen}
        options={{
          tabBarLabel: 'Shops',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'storefront' : 'storefront-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={SAPaymentsScreen}
        options={{
          tabBarLabel: 'Payments',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'card' : 'card-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={SAAnalyticsScreen}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'bar-chart' : 'bar-chart-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SASettingsScreen}
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
