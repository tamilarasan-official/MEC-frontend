import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StudentTabParamList } from '../../types';
import StudentHomeStack from '../stacks/StudentHomeStack';
import OrdersScreen from '../../screens/student/OrdersScreen';
import ScannerScreen from '../../screens/student/ScannerScreen';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';

const Tab = createBottomTabNavigator<StudentTabParamList>();

// Reusable pill wrapper — active tabs get a blue capsule background
const TabPill = ({ focused, children }: { focused: boolean; children: React.ReactNode }) => (
  <View style={[styles.pill, focused && styles.pillActive]}>
    {children}
  </View>
);

const HomeIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'home' : 'home-outline'} size={22} color={color} />
  </TabPill>
);

const OrdersIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'clipboard' : 'clipboard-outline'} size={22} color={color} />
  </TabPill>
);

const ScannerIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'qr-code' : 'qr-code-outline'} size={22} color={color} />
  </TabPill>
);

const styles = StyleSheet.create({
  pill: {
    width: 56, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  pillActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
});

export default function StudentTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
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
        options={{ tabBarLabel: 'Home', tabBarIcon: HomeIcon }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: OrdersIcon }}
      />
      <Tab.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{ tabBarLabel: 'Scanner', tabBarIcon: ScannerIcon }}
      />
    </Tab.Navigator>
  );
}
