import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { devSignIn, DEV_REQUESTER_EMAIL, DEV_RUNNER_EMAIL } from '@/lib/devAuth';

function normaliseZmPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return '+260' + digits.slice(1);
  if (digits.length === 9) return '+260' + digits;
  if (digits.length === 12 && digits.startsWith('260')) return '+' + digits;
  return null;
}

export default function Phone() {
  const { c, type, spacing } = useTheme();
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    const phone = normaliseZmPhone(raw);
    if (!phone) return Alert.alert('Invalid number', 'Use a Zambian mobile number, e.g. 097 1234567.');
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) return Alert.alert('Could not send code', error.message);
    router.push({ pathname: '/(auth)/otp', params: { phone } });
  }

  // DEV-ONLY bypass: skip Twilio OTP until SMS provider configured.
  async function runDevSignIn(email: string) {
    setBusy(true);
    await devSignIn(email);
    setBusy(false);
  }

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: spacing.xxl }}>
        <Text style={[type.h1, { color: c.text }]}>Your phone number</Text>
        <Text style={[type.body, { color: c.textMuted, marginTop: 6, marginBottom: spacing.xl }]}>
          We'll text you a 6-digit code.
        </Text>
        <TextField
          label="Phone"
          placeholder="097 1234567"
          keyboardType="phone-pad"
          autoFocus
          value={raw}
          onChangeText={setRaw}
        />
        <View style={{ flex: 1 }} />
        <Button label="Send Code" onPress={send} loading={busy} />
        {/* TODO: REMOVE BEFORE PUBLIC RELEASE — exposed in release APK for two-phone OTP-less testing. */}
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Button label="Dev: sign in as Requester" variant="secondary" onPress={() => runDevSignIn(DEV_REQUESTER_EMAIL)} loading={busy} />
          <Button label="Dev: sign in as Runner" variant="secondary" onPress={() => runDevSignIn(DEV_RUNNER_EMAIL)} loading={busy} />
        </View>
      </View>
    </Screen>
  );
}
