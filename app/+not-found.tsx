import React from 'react';
import { Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTheme } from '@/lib/theme';

export default function NotFound() {
  const { c, type, spacing } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, padding: spacing.xl }}>
        <Text style={[type.h1, { color: c.text, marginBottom: spacing.md }]}>Page not found</Text>
        <Link href="/" style={{ color: c.primary, fontSize: 17, fontWeight: '600' }}>Go home</Link>
      </View>
    </>
  );
}
