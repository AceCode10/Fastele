import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { bootstrapAuth, useAuth } from '@/stores/authStore';
import { useMode } from '@/stores/modeStore';
import { registerPushToken } from '@/lib/push';
import { startOfflineSync } from '@/lib/offlineQueue';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function Inner() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </>
  );
}

export default function RootLayout() {
  const [booted, setBooted] = useState(false);
  const hydrateMode = useMode((s) => s.hydrate);

  useEffect(() => {
    const unsub = startOfflineSync();
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      await bootstrapAuth();
      await hydrateMode();
      const uid = useAuth.getState().userId;
      if (uid) await registerPushToken(uid);
      setBooted(true);
    })();
  }, [hydrateMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SafeAreaProvider>{booted ? <Inner /> : null}</SafeAreaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
