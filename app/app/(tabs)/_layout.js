import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/config';

const ICONS = {
  index: 'grid-outline',
  generate: 'sparkles-outline',
  favorites: 'heart-outline',
  profile: 'person-outline',
  pricing: 'card-outline',
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Kuch Android devices (gesture nav) pe pehle render pe insets.bottom 0
  // aata hai jab tak layout settle na ho, isliye ek chhota minimum floor
  // rakha hai — isi wajah se pehle tab bar niche se "kat" jaata tha kyunki
  // uska height/padding is inset ko account nahi karta tha properly.
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
      <Tabs.Screen name="favorites" options={{ title: 'Favorites' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="pricing" options={{ title: 'Pricing' }} />
    </Tabs>
  );
}
