import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { bootstrapAuth, useAuth } from '@/stores/authStore';
import { useMode } from '@/stores/modeStore';
import { registerPushToken } from '@/lib/push';
import { startOfflineSync } from '@/lib/offlineQueue';

// expo-router catches render-time errors thrown anywhere under this layout
// and renders <ErrorBoundary>. Without this, an uncaught error during render
// in an Android release build closes the app silently (no LogBox).
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0E0E10', padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: '#FF8534', fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
        Something broke
      </Text>
      <Text style={{ color: '#F5F5F5', fontSize: 15, marginBottom: 16 }}>
        The screen failed to render. The error is shown below so you can report it.
      </Text>
      <ScrollView
        style={{ maxHeight: 280, backgroundColor: '#17171A', borderRadius: 8, padding: 12, marginBottom: 16 }}
      >
        <Text selectable style={{ color: '#FF4530', fontFamily: 'monospace', fontSize: 12 }}>
          {error?.name}: {error?.message}
        </Text>
        {!!error?.stack && (
          <Text selectable style={{ color: '#9A9A9F', fontFamily: 'monospace', fontSize: 11, marginTop: 8 }}>
            {error.stack}
          </Text>
        )}
      </ScrollView>
      <Pressable
        onPress={() => { retry(); }}
        style={{ backgroundColor: '#FF8534', paddingVertical: 14, borderRadius: 28, alignItems: 'center' }}
      >
        <Text style={{ color: '#1A0E05', fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function Inner() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'default' }} />
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SafeAreaProvider>{booted ? <Inner /> : null}</SafeAreaProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
