import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StudentTabParamList } from '../../types';
import StudentHomeStack from '../stacks/StudentHomeStack';
import OrdersScreen from '../../screens/student/OrdersScreen';
import ProfileScreen from '../../screens/student/ProfileScreen';
import Icon from '../../components/common/Icon';
import { colors } from '../../theme/colors';

const Tab = createBottomTabNavigator<StudentTabParamList>();

export default function StudentTabs() {
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
        component={StudentHomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
