import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/config';

const ICONS = {
  index: 'grid-outline',
  generate: 'sparkles-outline',
  profile: 'person-outline',
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 8);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 56 + bottom,
          paddingBottom: bottom,
          paddingTop: 6,
          elevation: 12,
          zIndex: 100,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name] || 'ellipse'} size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
      <Tabs.Screen name="generate" options={{ title: 'Generate' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/* Hidden — open from Profile; stack also has /travel */}
      <Tabs.Screen name="travel" options={{ href: null, title: 'Travel' }} />
    </Tabs>
  );
}
