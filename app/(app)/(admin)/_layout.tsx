import React from 'react';
import { Platform, Text, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/stores/authStore';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTheme } from '@/lib/theme';

export default function AdminLayout() {
  const { c, type } = useTheme();
  const profile = useAuth((s) => s.profile);
  const { isAdmin, isLoading } = useIsAdmin();

  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <Text style={[type.h2, { color: c.text }]}>Admin panel</Text>
        <Text style={[type.body, { color: c.textMuted }]}>Web only. Open on desktop.</Text>
      </View>
    );
  }

  if (!profile) return <Redirect href="/(auth)/welcome" />;

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <Text style={[type.body, { color: c.textMuted }]}>Checking admin access…</Text>
      </View>
    );
  }

  if (!isAdmin) return <Redirect href="/(app)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
