import React, { useState } from 'react';
import { Alert, Linking, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressPhoto } from '@/lib/photoCompress';
import { router } from 'expo-router';
import { Button, Card, MilestoneTimeline, Screen, SkeletonCard, StatusDot } from '@/components/ui';
import { type Milestone } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useActiveRunnerJob } from '@/hooks/useFeed';
import { enqueueMilestoneUpdate } from '@/lib/offlineQueue';
import { useTheme } from '@/lib/theme';

type RequestStatus = 'matched' | 'items_purchased' | 'in_transit';

const NEXT_STATUS: Record<RequestStatus, string> = {
  matched: 'items_purchased',
  items_purchased: 'in_transit',
  in_transit: 'in_transit',
};

const CTA_LABEL: Record<RequestStatus, string> = {
  matched: 'Items Purchased — Take Photo',
  items_purchased: 'Handing to Driver — Take Photo',
  in_transit: 'Waiting for confirmation…',
};

async function uploadPhoto(requestId: string, bucket: string, uri: string): Promise<string> {
  const ext = uri.split('.').pop() ?? 'jpg';
  const path = `${requestId}/${Date.now()}.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: `image/${ext}` });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export default function ActiveJob() {
  const { c, type, spacing } = useTheme();
  const profile = useAuth((s) => s.profile);
  const { data: job, isLoading } = useActiveRunnerJob(profile?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [taxiPlate, setTaxiPlate] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [offlineSaved, setOfflineSaved] = useState(false);

  if (isLoading) {
    return <Screen><SkeletonCard /><SkeletonCard /></Screen>;
  }

  if (!job) {
    return (
      <Screen>
        <StatusDot status="idle" label="No active job" />
        <Text style={[type.body, { color: c.textMuted, marginTop: spacing.md }]}>Browse the feed for new jobs.</Text>
        <Button label="Browse feed" variant="secondary" onPress={() => router.replace('/(app)/(runner)/feed')} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  const status = job.status as RequestStatus;
  const milestones = buildMilestones(job);

  async function advance() {
    if (!job) return;
    if (status === 'in_transit') return;

    const needsPhoto = status === 'matched' || status === 'items_purchased';
    const needsDriverDetails = status === 'items_purchased';

    if (needsDriverDetails && (!taxiPlate.trim() || !driverPhone.trim())) {
      return Alert.alert('Driver details required', 'Enter taxi plate and driver phone number.');
    }

    let photoUrl: string | null = null;
    if (needsPhoto) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        allowsEditing: false,
      });
      if (result.canceled) return;
      const rawUri = result.assets[0].uri;
      const uri = await compressPhoto(rawUri);
      setBusy(true);
      try {
        const bucket = status === 'matched' ? 'items' : 'handoff';
        photoUrl = await uploadPhoto(job.id, bucket, uri);
      } catch (e: any) {
        setBusy(false);
        return Alert.alert('Upload failed', e.message);
      }
    } else {
      setBusy(true);
    }

    const nextStatus = NEXT_STATUS[status];
    const now = new Date().toISOString();
    const updates: Record<string, any> = {
      status: nextStatus,
      milestone_timestamps: {
        ...(job.milestone_timestamps ?? {}),
        [nextStatus]: now,
      },
    };

    if (status === 'matched') updates.photo_items_url = photoUrl;
    if (status === 'items_purchased') {
      updates.photo_handoff_url = photoUrl;
      updates.taxi_plate = taxiPlate.trim().toUpperCase();
      updates.driver_phone = driverPhone.trim();
    }

    try {
      const { error } = await (supabase as any)
        .from('requests')
        .update(updates)
        .eq('id', job.id);
      if (error) throw error;
      setOfflineSaved(false);
    } catch (e: any) {
      // Network or RLS error — queue locally; offlineSync flushes on reconnect.
      await enqueueMilestoneUpdate(job.id, nextStatus, updates);
      setOfflineSaved(true);
    } finally {
      setBusy(false);
    }
  }

  function callDriver() {
    if (!job?.driver_phone) return;
    Linking.openURL(`tel:${job.driver_phone}`);
  }

  const ctaLabel = CTA_LABEL[status];
  const ctaDisabled = status === 'in_transit';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.sm }]}>Active job</Text>
      <Text style={[type.caption, { color: c.textMuted, marginBottom: spacing.lg }]}>
        Pickup: {job.pickup_location} → {job.delivery_address}
      </Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.sm }]}>Items</Text>
        {(job.item_list as string[]).map((item: string, i: number) => (
          <Text key={i} style={[type.body, { color: c.text }]}>• {item}</Text>
        ))}
        <Text style={[type.caption, { color: c.textMuted, marginTop: spacing.sm }]}>
          Item budget: K{job.item_budget} — spend this or less.
        </Text>
      </Card>

      <MilestoneTimeline milestones={milestones} />

      {status === 'items_purchased' && (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.md }]}>Driver details</Text>
          <TextInput
            placeholder="Taxi plate (e.g. ABB 1234)"
            placeholderTextColor={c.textMuted}
            value={taxiPlate}
            onChangeText={setTaxiPlate}
            autoCapitalize="characters"
            style={{ backgroundColor: c.surfaceAlt, borderRadius: 8, padding: 12, color: c.text, marginBottom: spacing.sm, minHeight: 48 }}
          />
          <TextInput
            placeholder="Driver phone (e.g. 097 1234567)"
            placeholderTextColor={c.textMuted}
            value={driverPhone}
            onChangeText={setDriverPhone}
            keyboardType="phone-pad"
            style={{ backgroundColor: c.surfaceAlt, borderRadius: 8, padding: 12, color: c.text, minHeight: 48 }}
          />
        </Card>
      )}

      {status === 'in_transit' && job.driver_phone && (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[type.bodyStrong, { color: c.text }]}>Taxi {job.taxi_plate}</Text>
          <Text style={[type.caption, { color: c.textMuted, marginTop: 4 }]}>Items handed over. Waiting for Requester to confirm delivery.</Text>
          <Button label={`Call Driver: ${job.driver_phone}`} variant="secondary" onPress={callDriver} style={{ marginTop: spacing.md }} />
        </Card>
      )}

      <View style={{ height: spacing.lg }} />
      {offlineSaved && (
        <Card style={{ marginBottom: spacing.md, borderColor: c.warning, borderWidth: 1 }}>
          <Text style={[type.bodyStrong, { color: c.warning }]}>Saved offline</Text>
          <Text style={[type.caption, { color: c.textMuted, marginTop: 4 }]}>
            We'll sync this milestone the moment you're back online.
          </Text>
        </Card>
      )}
      {!ctaDisabled && (
        <Button label={ctaLabel} onPress={advance} loading={busy} />
      )}
      {ctaDisabled && (
        <Text style={[type.caption, { color: c.textMuted, textAlign: 'center', marginTop: spacing.md }]}>
          Waiting for Requester to confirm delivery. Payment releases automatically after 48h.
        </Text>
      )}
    </ScrollView>
  );
}

function buildMilestones(job: any): Milestone[] {
  const ts = job.milestone_timestamps ?? {};
  const s = job.status as RequestStatus | 'in_transit';

  const order = ['matched', 'items_purchased', 'in_transit'];
  const labels: Record<string, string> = {
    matched: 'Accepted',
    items_purchased: 'Items Purchased',
    in_transit: 'Handed to Driver',
  };

  const statusIndex = order.indexOf(s);

  return order.map((key, i) => ({
    number: i + 1,
    label: labels[key],
    status: i < statusIndex ? 'done' : i === statusIndex ? 'active' : 'pending',
    timestamp: ts[key] ?? null,
    photoUrl:
      key === 'items_purchased' ? job.photo_items_url :
      key === 'in_transit' ? job.photo_handoff_url : null,
    requiredPhoto: key === 'items_purchased' || key === 'in_transit',
  }));
}
