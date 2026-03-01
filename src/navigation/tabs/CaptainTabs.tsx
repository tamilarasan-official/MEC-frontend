import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LinearGradient from 'react-native-linear-gradient';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchActiveShopOrders } from '../../store/slices/ordersSlice';
import { CaptainTabParamList } from '../../types';
import CaptainHomeScreen from '../../screens/captain/CaptainHomeScreen';
import CaptainPrepListScreen from '../../screens/captain/CaptainPrepListScreen';
import CaptainHistoryScreen from '../../screens/captain/CaptainHistoryScreen';
import CaptainEatScreen from '../../screens/captain/CaptainEatScreen';
import CaptainEatOrdersScreen from '../../screens/captain/CaptainEatOrdersScreen';
import CaptainScannerScreen from '../../screens/captain/CaptainScannerScreen';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';

const Tab = createBottomTabNavigator<CaptainTabParamList>();

// Pill indicator matching StudentTabs style
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

const PrepListIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'list' : 'list-outline'} size={22} color={color} />
  </TabPill>
);

const HistoryIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'time' : 'time-outline'} size={22} color={color} />
  </TabPill>
);

const EatHomeIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'home' : 'home-outline'} size={22} color={color} />
  </TabPill>
);

const EatOrdersIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'clipboard' : 'clipboard-outline'} size={22} color={color} />
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
  wrapper: {
    flex: 1,
  },
  scanFabRow: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    zIndex: 10,
  },
  scanFab: {
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  scanFabGradient: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(0,0,0,0.25)',
  },
});

export default function CaptainTabs() {
  const { colors } = useTheme();
  const userMode = useSelector((s: RootState) => s.user.userMode);
  const dispatch = useDispatch<AppDispatch>();
  const [showScanner, setShowScanner] = useState(false);

  const handleScanOrderUpdated = () => {
    dispatch(fetchActiveShopOrders());
  };

  // Eat mode: captain's own food ordering tabs
  if (userMode === 'eat') {
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
          name="EatFood"
          component={CaptainEatScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: EatHomeIcon,
          }}
        />
        <Tab.Screen
          name="EatOrders"
          component={CaptainEatOrdersScreen}
          options={{
            tabBarLabel: 'Orders',
            tabBarIcon: EatOrdersIcon,
          }}
        />
      </Tab.Navigator>
    );
  }

  return (
    <View style={styles.wrapper}>
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
          component={CaptainHomeScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: HomeIcon,
          }}
        />
        <Tab.Screen
          name="PrepList"
          component={CaptainPrepListScreen}
          options={{
            tabBarLabel: 'Prep List',
            tabBarIcon: PrepListIcon,
          }}
        />
        <Tab.Screen
          name="History"
          component={CaptainHistoryScreen}
          options={{
            tabBarLabel: 'History',
            tabBarIcon: HistoryIcon,
          }}
        />
      </Tab.Navigator>

      {/* QR Scanner FAB — overlaps tab bar */}
      <View style={styles.scanFabRow} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.scanFab}
          onPress={() => setShowScanner(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#10b981', '#06d6a0']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.scanFabGradient}
          >
            <Icon name="scan-outline" size={30} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* QR Scanner Modal */}
      <CaptainScannerScreen
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onOrderUpdated={handleScanOrderUpdated}
      />
    </View>
  );
}
