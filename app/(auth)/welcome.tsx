import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen } from '@/components/ui';
import { useTheme } from '@/lib/theme';
import { DEV_SKIP_OTP } from '@/lib/featureFlags';
import { devSignIn, DEV_REQUESTER_EMAIL, DEV_RUNNER_EMAIL } from '@/lib/devAuth';

export default function Welcome() {
  const { c, type, spacing } = useTheme();
  const [busy, setBusy] = useState<'requester' | 'runner' | null>(null);

  async function signInAs(role: 'requester' | 'runner') {
    setBusy(role);
    await devSignIn(role === 'requester' ? DEV_REQUESTER_EMAIL : DEV_RUNNER_EMAIL);
    setBusy(null);
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xxxl }}>
        <View>
          <Text style={[type.h1, { color: c.primary, fontSize: 48, lineHeight: 54 }]}>Fastele</Text>
          <Text style={[type.h3, { color: c.textMuted, marginTop: spacing.sm }]}>Get it done. Fast.</Text>
          <Text style={[type.body, { color: c.text, marginTop: spacing.xl, lineHeight: 26 }]}>
            Buy and send goods from Lusaka markets the safe way. Pay only when it arrives.
          </Text>
          {DEV_SKIP_OTP && (
            <Text style={[type.caption, { color: c.textMuted, marginTop: spacing.lg, fontStyle: 'italic' }]}>
              Test mode — OTP &amp; payments bypassed.
            </Text>
          )}
        </View>

        {DEV_SKIP_OTP ? (
          <View style={{ gap: spacing.sm }}>
            <Button
              label="Sign in as Requester"
              onPress={() => signInAs('requester')}
              loading={busy === 'requester'}
              disabled={busy !== null}
            />
            <Button
              label="Sign in as Runner"
              variant="secondary"
              onPress={() => signInAs('runner')}
              loading={busy === 'runner'}
              disabled={busy !== null}
            />
          </View>
        ) : (
          <Button label="Get Started" onPress={() => router.push('/(auth)/phone')} />
        )}
      </View>
    </Screen>
  );
}
