import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useRequest } from '@/hooks/useRequest';
import { useCreateDispute } from '@/hooks/useCreateDispute';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

type Reason = 'wrong_items' | 'missing_items' | 'not_delivered' | 'damaged' | 'other';

const REASONS: { value: Reason; label: string }[] = [
  { value: 'wrong_items', label: 'Wrong items delivered' },
  { value: 'missing_items', label: 'Items missing' },
  { value: 'not_delivered', label: 'Not delivered at all' },
  { value: 'damaged', label: 'Items damaged' },
  { value: 'other', label: 'Other' },
];

async function uploadEvidence(requestId: string, uri: string): Promise<string> {
  const ext = uri.split('.').pop() ?? 'jpg';
  const path = `${requestId}/dispute-${Date.now()}.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from('disputes').upload(path, blob, { contentType: `image/${ext}` });
  if (error) throw error;
  // Store path only — private bucket; admin signs URL on demand.
  return `disputes/${path}`;
}

export default function DisputeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, type, spacing, radius } = useTheme();
  const { data: req } = useRequest(id ?? null);
  const userId = useAuth((s) => s.userId);

  const [reason, setReason] = useState<Reason | null>(null);
  const [description, setDescription] = useState('');
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const createDispute = useCreateDispute();

  async function pickEvidence() {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!r.canceled) setEvidenceUri(r.assets[0].uri);
  }

  async function submit() {
    if (!reason) return Alert.alert('Select reason', 'Choose what went wrong.');
    if (!req || !userId) return;

    setBusy(true);
    try {
      let evidenceUrl: string | null = null;
      if (evidenceUri) evidenceUrl = await uploadEvidence(req.id, evidenceUri);

      await createDispute.mutateAsync({
        requestId: req.id,
        reason,
        description: description.trim() || null,
        evidenceUrl,
      });

      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <Screen>
        <Text style={[type.h1, { color: c.text, marginBottom: spacing.md }]}>Dispute raised</Text>
        <Text style={[type.body, { color: c.textMuted, marginBottom: spacing.xl }]}>
          Admin reviews within 72 hours. You and the Runner will both be notified of the outcome.
        </Text>
        <Button label="Back to home" onPress={() => router.replace('/(app)/(requester)' as any)} />
      </Screen>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.sm }]}>Raise dispute</Text>
      <Text style={[type.caption, { color: c.textMuted, marginBottom: spacing.xl }]}>
        Must be within 48 hours of delivery. Admin reviews within 72 hours.
      </Text>

      <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.sm }]}>What went wrong?</Text>
      {REASONS.map((r) => (
        <Pressable
          key={r.value}
          onPress={() => setReason(r.value)}
          style={[{
            padding: spacing.md,
            borderRadius: radius.md,
            borderWidth: 2,
            borderColor: reason === r.value ? c.primary : c.border,
            backgroundColor: reason === r.value ? c.primary + '15' : c.surface,
            marginBottom: spacing.sm,
          }]}
        >
          <Text style={[type.body, { color: reason === r.value ? c.primary : c.text }]}>{r.label}</Text>
        </Pressable>
      ))}

      <View style={{ marginTop: spacing.md }}>
        <Text style={[type.bodyStrong, { color: c.text, marginBottom: 6 }]}>Description (optional)</Text>
        <TextInput
          placeholder="Describe what happened…"
          placeholderTextColor={c.textMuted}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          style={{
            backgroundColor: c.surfaceAlt, borderRadius: radius.md,
            padding: 12, color: c.text, minHeight: 100, textAlignVertical: 'top',
            marginBottom: spacing.lg,
          }}
        />
      </View>

      <Card style={{ marginBottom: spacing.xl }}>
        <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.sm }]}>Photo evidence (recommended)</Text>
        {evidenceUri ? (
          <Image source={{ uri: evidenceUri }} style={{ width: '100%', height: 180, borderRadius: 8, marginBottom: spacing.md }} resizeMode="cover" />
        ) : null}
        <Button label={evidenceUri ? 'Retake photo' : 'Add photo'} variant="secondary" onPress={pickEvidence} />
      </Card>

      <Button label="Submit dispute" variant="danger" onPress={submit} loading={busy} disabled={!reason} />
    </ScrollView>
  );
}
