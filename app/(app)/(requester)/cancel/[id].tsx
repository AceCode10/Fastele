import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Screen, SkeletonCard } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useRequest } from '@/hooks/useRequest';
import { useTheme } from '@/lib/theme';

export default function RequesterCancel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, type, spacing } = useTheme();
  const { data: req } = useRequest(id ?? null);
  const [busy, setBusy] = useState(false);

  async function confirmCancel() {
    if (!req) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke('cancel-request', { body: { requestId: req.id } });
    setBusy(false);
    if (error) return Alert.alert('Could not cancel', error.message);
    Alert.alert('Cancelled', 'Refund on its way to your Airtel number.', [
      { text: 'OK', onPress: () => router.replace('/(app)/(requester)' as any) },
    ]);
  }

  if (!req) return <Screen><SkeletonCard /></Screen>;

  const fullRefund = req.status === 'open';
  const partialFee = +(req.runner_fee * 0.5).toFixed(2);
  const refundAmt = fullRefund ? req.item_budget + req.runner_fee : req.item_budget + req.runner_fee - partialFee;

  return (
    <Screen>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.md }]}>Cancel request</Text>
      <Card style={{ marginBottom: spacing.lg }}>
        {fullRefund ? (
          <>
            <Text style={[type.bodyStrong, { color: c.success }]}>Full refund</Text>
            <Text style={[type.body, { color: c.text, marginTop: spacing.sm }]}>
              No Runner accepted yet. You'll get K{refundAmt.toFixed(0)} back.
            </Text>
          </>
        ) : (
          <>
            <Text style={[type.bodyStrong, { color: c.warning }]}>Partial refund</Text>
            <Text style={[type.body, { color: c.text, marginTop: spacing.sm }]}>
              Runner already accepted. They'll receive K{partialFee.toFixed(0)} for their time. You'll get K{refundAmt.toFixed(0)} back.
            </Text>
          </>
        )}
      </Card>
      <Button label="Cancel request" variant="danger" onPress={confirmCancel} loading={busy} />
      <View style={{ height: spacing.md }} />
      <Button label="Keep request" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
