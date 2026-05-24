import React from 'react';
import { View } from 'react-native';
import { Slot, Redirect, useSegments } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModeToggle } from '@/components/ui';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/stores/authStore';

export default function AppLayout() {
  const { c, spacing } = useTheme();
  const userId = useAuth((s) => s.userId);
  const profile = useAuth((s) => s.profile);
  const segments = useSegments();

  const isAdminRoute = segments.includes('(admin)');

  if (!userId) return <Redirect href="/(auth)/welcome" />;
  if (!profile) return <Redirect href="/(auth)/name" />;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      {!isAdminRoute && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
          <ModeToggle />
        </View>
      )}
      <Slot />
    </SafeAreaView>
  );
}
