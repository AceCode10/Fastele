import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Screen, SkeletonCard, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useRequest } from '@/hooks/useRequest';
import { useTheme } from '@/lib/theme';

export default function RaiseOffer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, type, spacing } = useTheme();
  const { data: req } = useRequest(id ?? null);
  const [newFee, setNewFee] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!req) return;
    const fee = parseFloat(newFee);
    if (isNaN(fee) || fee <= req.runner_fee) {
      return Alert.alert('Too low', `Must be more than K${req.runner_fee}.`);
    }
    setBusy(true);
    const { error } = await supabase.functions.invoke('raise-offer', {
      body: { requestId: req.id, newRunnerFee: fee },
    });
    setBusy(false);
    if (error) return Alert.alert('Failed', error.message);
    Alert.alert('Offer raised', 'Runners will see your new offer immediately.', [
      { text: 'OK', onPress: () => router.replace(`/(app)/(requester)/request/${req.id}` as any) },
    ]);
  }

  if (!req) return <Screen><SkeletonCard /></Screen>;

  return (
    <Screen>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.md }]}>Raise offer</Text>
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.caption, { color: c.textMuted }]}>Current Runner fee</Text>
        <Text style={[type.h2, { color: c.primary }]}>K{req.runner_fee}</Text>
        <Text style={[type.caption, { color: c.textMuted, marginTop: spacing.sm }]}>
          Higher fee = faster pickup. Top up via Airtel after submit.
        </Text>
      </Card>
      <TextField
        label="New Runner fee (K)"
        keyboardType="numeric"
        value={newFee}
        onChangeText={setNewFee}
        autoFocus
      />
      <Button label="Raise offer" onPress={submit} loading={busy} />
      <View style={{ height: spacing.md }} />
      <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
