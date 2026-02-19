/**
 * MadrasOne - Campus Food & Services App
 * React Native Application Entry Point
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store } from './src/store';
import { RootNavigator } from './src/navigation';
import { ThemeProvider } from './src/theme/ThemeContext';
import ErrorBoundary from './src/components/common/ErrorBoundary';

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <ThemeProvider>
        <SafeAreaProvider>
          <ErrorBoundary>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          </ErrorBoundary>
        </SafeAreaProvider>
        </ThemeProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

export default App;
