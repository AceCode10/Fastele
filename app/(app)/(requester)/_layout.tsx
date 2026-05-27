import React from 'react';
import { Stack } from 'expo-router';

// Stack wraps the (tabs) tabbar so that detail screens (new-request,
// request/[id], cancel/[id], raise-offer/[id]) get pushed onto the Stack
// instead of being mounted as Tabs.Screen entries with `href: null`.
// The href: null pattern crashed Android release builds with
// react-native-screens@4 + newArchEnabled: "addViewAt: specified child
// already has a parent" (see app.config.ts §19-24).
export default function RequesterLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="new-request" />
      <Stack.Screen name="request/[id]" />
      <Stack.Screen name="cancel/[id]" />
      <Stack.Screen name="raise-offer/[id]" />
    </Stack>
  );
}
