import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AccountantTabParamList } from '../../types';
import AccDashboardScreen from '../../screens/accountant/AccDashboardScreen';
import AccStudentsScreen from '../../screens/accountant/AccStudentsScreen';
import AccPaymentsScreen from '../../screens/accountant/AccPaymentsScreen';
import AccPayablesScreen from '../../screens/accountant/AccPayablesScreen';
import AccReportsScreen from '../../screens/accountant/AccReportsScreen';
import AccSettingsScreen from '../../screens/accountant/AccSettingsScreen';
import { Icon } from '../../components/common/Icon';
import { colors } from '../../theme/colors';

const Tab = createBottomTabNavigator<AccountantTabParamList>();

export default function AccountantTabs() {
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
        component={AccDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Students"
        component={AccStudentsScreen}
        options={{
          tabBarLabel: 'Students',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'people' : 'people-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={AccPaymentsScreen}
        options={{
          tabBarLabel: 'Payments',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'wallet' : 'wallet-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Payables"
        component={AccPayablesScreen}
        options={{
          tabBarLabel: 'Payables',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'cash' : 'cash-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={AccReportsScreen}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'document-text' : 'document-text-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={AccSettingsScreen}
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
