import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Screen, SkeletonCard, StatusDot } from '@/components/ui';
import { useRequest } from '@/hooks/useRequest';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';
import { assertTapDepth } from '@/lib/threeTap';

// TAP DEPTH: feed card = tap 1. Accept = tap 2. Total: 2. Spec §9.2.

export default function RequestPreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, type, spacing } = useTheme();
  const { data: req, isLoading } = useRequest(id ?? null);
  const userId = useAuth((s) => s.userId);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => { assertTapDepth('runner.feed->accept', 2); }, []);

  async function accept() {
    if (!req || !userId) return;
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await (supabase as any)
      .from('requests')
      .update({
        runner_id: userId,
        status: 'matched',
        accepted_at: now,
        milestone_timestamps: { ...(req.milestone_timestamps ?? {}), accepted: now },
      })
      .eq('id', req.id)
      .eq('status', 'open');
    setBusy(false);
    if (error) return Alert.alert('Could not accept', error.message);
    router.replace('/(app)/(runner)/active-job' as any);
  }

  if (isLoading || !req) {
    return <Screen><SkeletonCard /><SkeletonCard /></Screen>;
  }

  if (req.status !== 'open') {
    return (
      <Screen>
        <StatusDot status="problem" label="Already taken" />
        <Text style={[type.body, { color: c.textMuted, marginTop: spacing.md }]}>Another Runner accepted this job.</Text>
        <Button label="Back to feed" onPress={() => router.back()} variant="secondary" style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.lg }]}>Job details</Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.bodyStrong, { color: c.text }]}>Pickup</Text>
        <Text style={[type.body, { color: c.primary, marginTop: 4 }]}>{req.pickup_location}</Text>
        <View style={{ height: 12 }} />
        <Text style={[type.bodyStrong, { color: c.text }]}>Deliver to</Text>
        <Text style={[type.body, { color: c.text, marginTop: 4 }]}>{req.delivery_address}</Text>
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.sm }]}>Items to buy</Text>
        {(req.item_list as string[]).map((item: string, i: number) => (
          <Text key={i} style={[type.body, { color: c.text }]}>• {item}</Text>
        ))}
        <Text style={[type.caption, { color: c.textMuted, marginTop: spacing.sm }]}>Item budget: K{req.item_budget}</Text>
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={[type.caption, { color: c.textMuted }]}>Your earnings</Text>
            <Text style={[type.h2, { color: c.primary }]}>K{(req.runner_fee * 0.9).toFixed(0)}</Text>
            <Text style={[type.caption, { color: c.textMuted }]}>after 10% platform fee</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[type.caption, { color: c.textMuted }]}>Requester</Text>
            {req.requester?.requester_rating_count >= 5 ? (
              <Text style={[type.bodyStrong, { color: c.text }]}>★ {req.requester.requester_rating_avg?.toFixed(1)}</Text>
            ) : (
              <Text style={[type.bodyStrong, { color: c.textMuted }]}>New</Text>
            )}
          </View>
        </View>
      </Card>

      <Button label="Accept Job" onPress={accept} loading={busy} />
    </Screen>
  );
}
