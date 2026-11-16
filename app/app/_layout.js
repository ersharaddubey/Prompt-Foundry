import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { AuthProvider } from '../src/context/AuthContext';
import { COLORS } from '../src/constants/config';

Sentry.init({
  dsn: 'https://240bfbcd405f75903e28b2e371d5e626@o4512424104427520.ingest.us.sentry.io/4512424122449920',
  enableNative: true,
  enableNativeCrashHandling: true,
  debug: __DEV__,
});


function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="detail/[id]" />
            <Stack.Screen name="travel" />
            <Stack.Screen name="favorites" />
            <Stack.Screen name="pricing" />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
