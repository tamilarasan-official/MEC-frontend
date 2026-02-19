import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StudentTabParamList } from '../../types';
import StudentHomeStack from '../stacks/StudentHomeStack';
import OrdersScreen from '../../screens/student/OrdersScreen';
import ScannerScreen from '../../screens/student/ScannerScreen';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';

const Tab = createBottomTabNavigator<StudentTabParamList>();

const HomeIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <Icon name={focused ? 'home' : 'home-outline'} size={22} color={color} />
);

const OrdersIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <Icon name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
);

const ScannerIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <Icon name={focused ? 'qr-code' : 'qr-code-outline'} size={22} color={color} />
);

export default function StudentTabs() {
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
        component={StudentHomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: HomeIcon,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: OrdersIcon,
        }}
      />
      <Tab.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scanner',
          tabBarIcon: ScannerIcon,
        }}
      />
    </Tab.Navigator>
  );
}
