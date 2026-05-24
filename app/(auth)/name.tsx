import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

export default function Name() {
  const { c, type, spacing } = useTheme();
  const userId = useAuth((s) => s.userId);
  const refreshProfile = useAuth((s) => s.refreshProfile);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!first.trim() || !last.trim()) return Alert.alert('Both names required');
    if (!userId) return Alert.alert('Session expired');
    setBusy(true);
    const fullName = `${first.trim()} ${last.trim()}`;
    const { data: u } = await supabase.auth.getUser();
    const phone = u.user?.phone ? '+' + u.user.phone : '';
    const { error } = await (supabase as any)
      .from('users')
      .upsert({ id: userId, full_name: fullName, phone_number: phone, default_mode: 'requester' });
    setBusy(false);
    if (error) return Alert.alert('Could not save', error.message);
    await refreshProfile();
    router.replace('/(auth)/mode-select');
  }

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: spacing.xxl }}>
        <Text style={[type.h1, { color: c.text }]}>What's your name?</Text>
        <Text style={[type.body, { color: c.textMuted, marginTop: 6, marginBottom: spacing.xl }]}>
          This is what Runners and Requesters will see.
        </Text>
        <TextField label="First name" autoFocus value={first} onChangeText={setFirst} />
        <TextField label="Last name" value={last} onChangeText={setLast} />
        <View style={{ flex: 1 }} />
        <Button label="Continue" onPress={save} loading={busy} />
      </View>
    </Screen>
  );
}
