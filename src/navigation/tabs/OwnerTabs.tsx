import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchActiveShopOrders } from '../../store/slices/ordersSlice';
import { fetchShopDetails } from '../../store/slices/userSlice';
import { OwnerTabParamList } from '../../types';
import OwnerHomeScreen from '../../screens/owner/OwnerHomeScreen';
import OwnerMenuScreen from '../../screens/owner/OwnerMenuScreen';
import OwnerAnalyticsScreen from '../../screens/owner/OwnerAnalyticsScreen';
import OldStationeryAnalyticsScreen from '../../screens/owner/StationeryAnalyticsScreen';
import StationeryAnalyticsScreen from '../../screens/stationery_owner/StationeryAnalyticsScreen';
import CaptainPrepListScreen from '../../screens/captain/CaptainPrepListScreen';
import OwnerHistoryScreen from '../../screens/owner/OwnerHistoryScreen';
import CaptainEatScreen from '../../screens/captain/CaptainEatScreen';
import CaptainEatOrdersScreen from '../../screens/captain/CaptainEatOrdersScreen';
import CaptainScannerScreen from '../../screens/captain/CaptainScannerScreen';
import ScannerScreen from '../../screens/student/ScannerScreen';
import StationeryHomeScreen from '../../screens/stationery_owner/StationeryHomeScreen';
import StationeryHistoryScreen from '../../screens/stationery_owner/StationeryHistoryScreen';
import WalletScreen from '../../screens/student/WalletScreen';
import TransactionDetailScreen from '../../screens/student/TransactionDetailScreen';
import TransactionPINScreen from '../../screens/shared/TransactionPINScreen';
import Icon from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeContext';

const Tab = createBottomTabNavigator<OwnerTabParamList>();

// Pill indicator matching captain/student tabs style
const TabPill = ({ focused, children }: { focused: boolean; children: React.ReactNode }) => {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.pill, focused && { backgroundColor: c.accent + '26' }]}>
      {children}
    </View>
  );
};

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

const MenuIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'restaurant' : 'restaurant-outline'} size={22} color={color} />
  </TabPill>
);

const AnalyticsIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'bar-chart' : 'bar-chart-outline'} size={22} color={color} />
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

const EatScannerIcon = ({ focused, color }: { focused: boolean; color: string }) => (
  <TabPill focused={focused}>
    <Icon name={focused ? 'scan' : 'scan-outline'} size={22} color={color} />
  </TabPill>
);

const styles = StyleSheet.create({
  pill: {
    width: 56, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  // pillActive color is now applied inline via theme
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

// Non-food shop categories that get the stationery dashboard
const NON_FOOD_CATEGORIES = ['stationery', 'laundry', 'other'];

export default function OwnerTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);
  const tabBarPaddingBottom = Math.max(insets.bottom, 8);
  const userMode = useSelector((s: RootState) => s.user.userMode);
  const shopDetails = useSelector((s: RootState) => s.user.shopDetails);
  const dispatch = useDispatch<AppDispatch>();
  const [showScanner, setShowScanner] = useState(false);

  // Fetch shop details on mount so we know the category for routing
  useEffect(() => {
    dispatch(fetchShopDetails());
  }, [dispatch]);

  const isNonFoodShop = shopDetails?.category
    ? NON_FOOD_CATEGORIES.includes(shopDetails.category)
    : false;
  const isQRShop = isNonFoodShop && shopDetails?.canGenerateQR === true;

  const handleScanOrderUpdated = () => {
    dispatch(fetchActiveShopOrders());
  };

  // Eat mode: owner's own food ordering tabs
  if (userMode === 'eat') {
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
            paddingBottom: tabBarPaddingBottom,
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
        <Tab.Screen
          name="EatScanner"
          component={ScannerScreen}
          options={{
            tabBarLabel: 'Scanner',
            tabBarIcon: EatScannerIcon,
          }}
        />
        <Tab.Screen
          name="Wallet"
          component={WalletScreen}
          options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
        />
        <Tab.Screen
          name="TransactionDetail"
          component={TransactionDetailScreen}
          options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
        />
        <Tab.Screen
          name="TransactionPIN"
          component={TransactionPINScreen}
          options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
        />
      </Tab.Navigator>
    );
  }

  // Work mode: owner dashboard tabs
  return (
    <View style={styles.wrapper}>
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
            paddingBottom: tabBarPaddingBottom,
            paddingTop: 4,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name={isNonFoodShop ? 'StationeryDashboard' : 'Home'}
          component={isNonFoodShop ? StationeryHomeScreen : OwnerHomeScreen}
          key={isNonFoodShop ? 'stationery' : 'home'}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: HomeIcon,
          }}
        />
        {!isNonFoodShop && (
          <Tab.Screen
            name="PrepList"
            component={CaptainPrepListScreen}
            options={{
              tabBarLabel: 'Prep List',
              tabBarIcon: PrepListIcon,
            }}
          />
        )}

        <Tab.Screen
          name="Menu"
          component={OwnerMenuScreen}
          options={{
            tabBarLabel: 'Items',
            tabBarIcon: MenuIcon,
          }}
        />
        <Tab.Screen
          name="History"
          component={isQRShop ? StationeryHistoryScreen : OwnerHistoryScreen}
          options={{
            tabBarLabel: 'History',
            tabBarIcon: HistoryIcon,
          }}
        />
        {isNonFoodShop && (
          <Tab.Screen
            name="StationeryAnalytics"
            component={isQRShop ? StationeryAnalyticsScreen : OwnerAnalyticsScreen}
            options={{
              tabBarLabel: 'Analytics',
              tabBarIcon: AnalyticsIcon,
            }}
          />
        )}
        {/* Hidden screens (food shop analytics + old stationery analytics for navigation compat) */}
        <Tab.Screen
          name="Analytics"
          component={OwnerAnalyticsScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="OldStationeryAnalytics"
          component={OldStationeryAnalyticsScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
      </Tab.Navigator>

      {/* QR Scanner FAB — food shops only (stationery uses QR payments, not order scanning) */}
      {!isNonFoodShop && (
        <>
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

          <CaptainScannerScreen
            visible={showScanner}
            onClose={() => setShowScanner(false)}
            onOrderUpdated={handleScanOrderUpdated}
          />
        </>
      )}
    </View>
  );
}
