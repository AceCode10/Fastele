import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function Otp() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { c, type, spacing } = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function verify() {
    if (code.length !== 6) return Alert.alert('Need 6 digits');
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: phone!, token: code, type: 'sms' });
    setBusy(false);
    if (error) return Alert.alert('Wrong code', error.message);
    router.replace('/(auth)/name');
  }

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: spacing.xxl }}>
        <Text style={[type.h1, { color: c.text }]}>Enter the code</Text>
        <Text style={[type.body, { color: c.textMuted, marginTop: 6, marginBottom: spacing.xl }]}>
          Sent to {phone}. Auto-fills if you grant SMS permission.
        </Text>
        <TextField
          label="6-digit code"
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          value={code}
          onChangeText={setCode}
          textContentType="oneTimeCode"
        />
        <View style={{ flex: 1 }} />
        <Button label="Verify" onPress={verify} loading={busy} />
      </View>
    </Screen>
  );
}
