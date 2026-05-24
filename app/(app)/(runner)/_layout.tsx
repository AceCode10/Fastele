import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

// Spec §4.2 runner tabs: Feed | Active Job | Earnings | Profile.
export default function RunnerLayout() {
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
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="active-job"
        options={{
          title: 'Active Job',
          tabBarIcon: ({ color, size }) => <Ionicons name="navigate-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="verify" options={{ href: null }} />
      <Tabs.Screen name="cancel" options={{ href: null }} />
      <Tabs.Screen name="request/[id]/preview" options={{ href: null }} />
    </Tabs>
  );
}
