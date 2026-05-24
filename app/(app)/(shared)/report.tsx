import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

// Usage: router.push({ pathname: '/(app)/(shared)/report', params: { reportedId, requestId? } })

type Reason = 'wrong_items' | 'not_delivered' | 'fraud' | 'threatening' | 'other';

const REASONS: { value: Reason; label: string }[] = [
  { value: 'wrong_items', label: 'Wrong items' },
  { value: 'not_delivered', label: 'Not delivered' },
  { value: 'fraud', label: 'Fraud or scam' },
  { value: 'threatening', label: 'Threatening behaviour' },
  { value: 'other', label: 'Other' },
];

export default function Report() {
  const { reportedId, requestId } = useLocalSearchParams<{ reportedId: string; requestId?: string }>();
  const { c, type, spacing, radius } = useTheme();
  const userId = useAuth((s) => s.userId);

  const [reason, setReason] = useState<Reason | null>(null);
  const [description, setDescription] = useState('');
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function pickEvidence() {
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!r.canceled) setEvidenceUri(r.assets[0].uri);
  }

  async function submit() {
    if (!reason) return Alert.alert('Select reason');
    if (!userId || !reportedId) return;

    setBusy(true);
    try {
      let evidenceUrl: string | null = null;
      if (evidenceUri) {
        const ext = evidenceUri.split('.').pop() ?? 'jpg';
        const path = `${userId}/${Date.now()}.${ext}`;
        const blob = await (await fetch(evidenceUri)).blob();
        const { error: upErr } = await supabase.storage.from('reports').upload(path, blob, { contentType: `image/${ext}` });
        if (!upErr) evidenceUrl = `reports/${path}`;
      }

      const { error } = await (supabase as any).from('reports').insert({
        reporter_id: userId,
        reported_id: reportedId,
        request_id: requestId ?? null,
        reason,
        description: description.trim() || null,
        evidence_url: evidenceUrl,
      });
      if (error) throw error;
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
        <Text style={[type.h1, { color: c.text, marginBottom: spacing.md }]}>Report submitted</Text>
        <Text style={[type.body, { color: c.textMuted, marginBottom: spacing.xl }]}>
          Admin reviews within 24 hours. Three verified reports triggers automatic review.
        </Text>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.sm }]}>Report a problem</Text>
      <Text style={[type.caption, { color: c.textMuted, marginBottom: spacing.xl }]}>Admin notified immediately.</Text>

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

      <TextInput
        placeholder="Optional: describe what happened"
        placeholderTextColor={c.textMuted}
        multiline numberOfLines={4}
        value={description} onChangeText={setDescription}
        style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: 12, color: c.text, minHeight: 100, textAlignVertical: 'top', marginTop: spacing.lg, marginBottom: spacing.lg }}
      />

      {evidenceUri
        ? <Image source={{ uri: evidenceUri }} style={{ width: '100%', height: 160, borderRadius: 8, marginBottom: spacing.md }} resizeMode="cover" />
        : null}
      <Button label="Add photo (optional)" variant="secondary" onPress={pickEvidence} style={{ marginBottom: spacing.xl }} />

      <Button label="Submit report" variant="danger" onPress={submit} loading={busy} disabled={!reason} />
    </ScrollView>
  );
}
