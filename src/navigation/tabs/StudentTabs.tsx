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

interface TabItemProps {
  focused: boolean;
  color: string;
  icon: string;
  iconFocused: string;
  label: string;
}

const TabItem = ({ focused, color, icon, iconFocused, label }: TabItemProps) => {
  const { colors } = useTheme();
  return (
    <View style={styles.tabItem}>
      <View style={[styles.iconWrap, focused && { backgroundColor: colors.accent + '18' }]}>
        <Icon name={focused ? iconFocused : icon} size={20} color={color} />
      </View>
      <Text style={[styles.tabLabel, { color: focused ? colors.accent : colors.mutedForeground }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const HomeIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabItem focused={focused} color={color} icon="home-outline" iconFocused="home" label="Home" />
);
const OrdersIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabItem focused={focused} color={color} icon="receipt-outline" iconFocused="receipt" label="Orders" />
);
const ScannerIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabItem focused={focused} color={color} icon="scan-outline" iconFocused="scan" label="Scan" />
);

export default function StudentTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 10,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={StudentHomeStack}
        options={{ tabBarIcon: HomeIcon }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ tabBarIcon: OrdersIcon }}
      />
      <Tab.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{ tabBarIcon: ScannerIcon }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 56,
  },
  iconWrap: {
    width: 44, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  tabLabel: {
    fontSize: 10, fontWeight: '600', letterSpacing: 0.3,
  },
});
