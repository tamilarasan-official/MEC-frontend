import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudentTabParamList } from '../../types';
import StudentHomeStack from '../stacks/StudentHomeStack';
import OrdersScreen from '../../screens/student/OrdersScreen';
import ScannerScreen from '../../screens/student/ScannerScreen';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';

const Tab = createBottomTabNavigator<StudentTabParamList>();

// Reusable pill wrapper — active tabs get a themed capsule background
const TabPill = ({ focused, children }: { focused: boolean; children: React.ReactNode }) => {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.pill, focused && { backgroundColor: c.accent + '17' }]}>
      {children}
    </View>
  );
};

const HomeIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'home' : 'home-outline'} size={20} color={color} />
  </TabPill>
);

const OrdersIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'receipt' : 'receipt-outline'} size={20} color={color} />
  </TabPill>
);

const ScannerIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'scan' : 'scan-outline'} size={20} color={color} />
  </TabPill>
);

const styles = StyleSheet.create({
  pill: {
    width: 44, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
});

export default function StudentTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
          height: tabBarHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
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
