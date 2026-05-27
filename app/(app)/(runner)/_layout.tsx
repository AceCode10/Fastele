import React from 'react';
import { Stack } from 'expo-router';

// Stack wraps the (tabs) tabbar. This mirrors the requester layout so future
// runner-side detail screens can be pushed without re-introducing the
// react-native-screens 4 + new-arch "addViewAt" crash (see app.config.ts
// §19-24). It also makes tab->tab pushes (e.g. feed -> active-job) safe.
export default function RunnerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
