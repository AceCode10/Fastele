import React, { useState } from 'react';
import { Alert, Image, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

async function uploadVerificationPhoto(userId: string, bucket: 'nrc' | 'selfies', uri: string): Promise<string> {
  const ext = uri.split('.').pop() ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: `image/${ext}`,
    upsert: true,
  });
  if (error) throw error;
  // Store path only — admin generates short-lived signed URL on demand.
  return `${bucket}/${path}`;
}

export default function RunnerVerify() {
  const { c, type, spacing } = useTheme();
  const userId = useAuth((s) => s.userId);
  const refreshProfile = useAuth((s) => s.refreshProfile);

  const [nrcUri, setNrcUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function pickNrc() {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
    if (!r.canceled) setNrcUri(r.assets[0].uri);
  }

  async function pickSelfie() {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, cameraType: ImagePicker.CameraType.front });
    if (!r.canceled) setSelfieUri(r.assets[0].uri);
  }

  async function submit() {
    if (!nrcUri) return Alert.alert('NRC required', 'Take a clear photo of your National Registration Card.');
    if (!selfieUri) return Alert.alert('Selfie required', 'Take a selfie matching your NRC photo.');
    if (!userId) return;

    setBusy(true);
    try {
      const [nrcUrl, selfieUrl] = await Promise.all([
        uploadVerificationPhoto(userId, 'nrc', nrcUri),
        uploadVerificationPhoto(userId, 'selfies', selfieUri),
      ]);

      const { error } = await (supabase as any).from('users').update({
        nrc_photo_url: nrcUrl,
        selfie_url: selfieUrl,
      }).eq('id', userId);

      if (error) throw error;

      await refreshProfile();
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <Screen>
        <Text style={[type.h1, { color: c.text, marginBottom: spacing.md }]}>Under review</Text>
        <Text style={[type.body, { color: c.textMuted, marginBottom: spacing.xl }]}>
          We're reviewing your ID. Usually under 24 hours. We'll SMS you when approved.
        </Text>
        <Text style={[type.caption, { color: c.textMuted }]}>
          While you wait, you can browse the feed in read-only mode.
        </Text>
        <Button label="Browse feed" variant="secondary" onPress={() => router.replace('/(app)/(runner)/feed' as any)} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.sm }]}>Verify your ID</Text>
      <Text style={[type.body, { color: c.textMuted, marginBottom: spacing.xl }]}>
        Required before accepting jobs. Takes less than 24 hours.
      </Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.sm }]}>1. NRC photo</Text>
        <Text style={[type.caption, { color: c.textMuted, marginBottom: spacing.md }]}>
          Ensure the card is clear and fully visible. Both sides not needed — front only.
        </Text>
        {nrcUri ? (
          <Image source={{ uri: nrcUri }} style={{ width: '100%', height: 180, borderRadius: 8, marginBottom: spacing.md }} resizeMode="cover" />
        ) : null}
        <Button label={nrcUri ? 'Retake NRC photo' : 'Take NRC photo'} variant={nrcUri ? 'secondary' : 'primary'} onPress={pickNrc} />
      </Card>

      <Card style={{ marginBottom: spacing.xl }}>
        <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.sm }]}>2. Selfie</Text>
        <Text style={[type.caption, { color: c.textMuted, marginBottom: spacing.md }]}>
          Look directly at the camera. Must match your NRC photo.
        </Text>
        {selfieUri ? (
          <Image source={{ uri: selfieUri }} style={{ width: 160, height: 160, borderRadius: 80, alignSelf: 'center', marginBottom: spacing.md }} resizeMode="cover" />
        ) : null}
        <Button label={selfieUri ? 'Retake selfie' : 'Take selfie'} variant={selfieUri ? 'secondary' : 'primary'} onPress={pickSelfie} />
      </Card>

      <Button label="Submit for review" onPress={submit} loading={busy} disabled={!nrcUri || !selfieUri} />
    </ScrollView>
  );
}
