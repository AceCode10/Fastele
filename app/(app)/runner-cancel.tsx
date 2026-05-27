import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useActiveRunnerJob } from '@/hooks/useFeed';
import { useTheme } from '@/lib/theme';

type Reason = 'emergency' | 'wrong_location' | 'item_unavailable' | 'other';

const REASONS: { value: Reason; label: string }[] = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'wrong_location', label: 'Wrong location / cannot reach market' },
  { value: 'item_unavailable', label: 'Items unavailable' },
  { value: 'other', label: 'Other' },
];

export default function RunnerCancel() {
  const { c, type, spacing, radius } = useTheme();
  const profile = useAuth((s) => s.profile);
  const { data: job } = useActiveRunnerJob(profile?.id ?? null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason || !job) return Alert.alert('Pick reason');
    setBusy(true);
    const { error } = await supabase.functions.invoke('cancel-request', {
      body: { requestId: job.id, reason },
    });
    setBusy(false);
    if (error) return Alert.alert('Failed', error.message);
    Alert.alert('Cancelled', 'Your rating dropped by 0.1. Job returned to feed for another Runner.', [
      { text: 'OK', onPress: () => router.replace('/(app)/(runner)/feed' as any) },
    ]);
  }

  if (!job) {
    return (
      <Screen>
        <Text style={[type.body, { color: c.textMuted }]}>No active job to cancel.</Text>
        <Button label="Back to feed" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.md }]}>Cancel this job</Text>
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.bodyStrong, { color: c.warning }]}>This affects your rating</Text>
        <Text style={[type.body, { color: c.text, marginTop: spacing.sm }]}>
          Your runner rating drops by 0.1. Three cancellations in 30 days = warning. Five = suspension.
        </Text>
      </Card>

      <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.sm }]}>Why are you cancelling?</Text>
      {REASONS.map((r) => (
        <Pressable
          key={r.value}
          onPress={() => setReason(r.value)}
          style={{
            padding: spacing.md, borderRadius: radius.md, borderWidth: 2,
            borderColor: reason === r.value ? c.accent : c.border,
            backgroundColor: reason === r.value ? c.accent + '15' : c.surface,
            marginBottom: spacing.sm,
          }}
        >
          <Text style={[type.body, { color: reason === r.value ? c.accent : c.text }]}>{r.label}</Text>
        </Pressable>
      ))}

      <View style={{ height: spacing.lg }} />
      <Button label="Submit cancellation" variant="danger" onPress={submit} loading={busy} disabled={!reason} />
      <View style={{ height: spacing.md }} />
      <Button label="Keep job" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}
