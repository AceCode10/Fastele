import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

// Spec §4.2 tabs: My Requests | History | Profile.
// Detail screens (new-request, request/[id], cancel/[id], raise-offer/[id])
// live one level up in (requester)/ and are pushed onto the parent Stack —
// NOT registered here as Tabs.Screen with href: null. That pattern crashes on
// Android (react-native-screens 4 + new arch): "addViewAt: specified child
// already has a parent". See app.config.ts §19-24 for the historical note.
export default function RequesterTabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.border, height: 60, paddingBottom: 6, paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
