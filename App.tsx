/**
 * CampusOne - Campus Food & Services App
 * React Native Application Entry Point
 */

import React, { useEffect } from 'react';
import { StatusBar, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { store } from './src/store';
import { RootNavigator } from './src/navigation';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { runSecurityChecks, shouldBlockApp, shouldWarnUser } from './src/utils/securityCheck';

function AppContent(): React.JSX.Element {
  useEffect(() => {
    runSecurityChecks().then(result => {
      if (shouldBlockApp(result)) {
        // Rooted device or repackaged APK — block with non-dismissible alert
        Alert.alert(
          'Security Check Failed',
          'CampusOne cannot run on rooted or modified devices. Please use a standard device.',
          [],
          { cancelable: false }
        );
      } else if (shouldWarnUser(result)) {
        if (__DEV__) console.warn('[Security] Running on emulator — security features reduced');
      }
    });
  }, []);
  const { isDark, colors } = useTheme();

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.card, border: colors.border } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.card, border: colors.border } };

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <SafeAreaProvider>
        <ErrorBoundary>
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </>
  );
}

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Provider store={store}>
        <ThemeProvider>
          <BottomSheetModalProvider>
            <AppContent />
          </BottomSheetModalProvider>
        </ThemeProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

export default App;
