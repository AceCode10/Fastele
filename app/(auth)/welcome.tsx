import React from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen } from '@/components/ui';
import { useTheme } from '@/lib/theme';

export default function Welcome() {
  const { c, type, spacing } = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xxxl }}>
        <View>
          <Text style={[type.h1, { color: c.primary, fontSize: 48, lineHeight: 54 }]}>Fastele</Text>
          <Text style={[type.h3, { color: c.textMuted, marginTop: spacing.sm }]}>Get it done. Fast.</Text>
          <Text style={[type.body, { color: c.text, marginTop: spacing.xl, lineHeight: 26 }]}>
            Buy and send goods from Lusaka markets the safe way. Pay only when it arrives.
          </Text>
        </View>
        <Button label="Get Started" onPress={() => router.push('/(auth)/phone')} />
      </View>
    </Screen>
  );
}
