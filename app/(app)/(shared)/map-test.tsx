import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

// Fallback for Expo Router. Native uses map-test.native.tsx, web uses map-test.web.tsx.
export default function MapTest() {
  const { c, type, spacing } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: spacing.lg }}>
      <Text style={[type.h1, { color: c.text }]}>Map smoke test</Text>
      <Text style={[type.body, { color: c.textMuted, marginTop: spacing.md }]}>
        Not available on this platform.
      </Text>
    </View>
  );
}
