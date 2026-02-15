/**
 * MadrasOne - Campus Food & Services App
 * React Native Application Entry Point
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store } from './src/store';
import { RootNavigator } from './src/navigation';
import { colors } from './src/theme/colors';
import ErrorBoundary from './src/components/common/ErrorBoundary';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <SafeAreaProvider>
          <ErrorBoundary>
          <NavigationContainer>
            <StatusBar
              barStyle={isDarkMode ? 'light-content' : 'dark-content'}
              backgroundColor={colors.white}
            />
            <RootNavigator />
          </NavigationContainer>
          </ErrorBoundary>
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

export default App;
