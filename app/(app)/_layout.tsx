import React from 'react';
import { Slot, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/stores/authStore';

export default function AppLayout() {
  const { c } = useTheme();
  const userId = useAuth((s) => s.userId);
  const profile = useAuth((s) => s.profile);

  if (!userId) return <Redirect href="/(auth)/welcome" />;
  if (!profile) return <Redirect href="/(auth)/name" />;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <Slot />
    </SafeAreaView>
  );
}
