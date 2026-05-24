import React, { useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, ErrorState, MilestoneTimeline, RatingCard, Screen, SkeletonCard, StatusDot } from '@/components/ui';
import { type Milestone } from '@/components/ui';
import { useRequest } from '@/hooks/useRequest';
import { useSubmitRating } from '@/hooks/useRating';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, type, spacing } = useTheme();
  const { data: req, isLoading, isError, refetch } = useRequest(id ?? null);
  const userId = useAuth((s) => s.userId);
  const { mutateAsync: submitRating } = useSubmitRating();
  const [confirming, setConfirming] = useState(false);
  const [rated, setRated] = useState(false);

  if (isLoading) {
    return <Screen><SkeletonCard /><SkeletonCard /></Screen>;
  }
  if (isError || !req) {
    return <Screen><ErrorState title="Could not load errand" onRetry={() => refetch()} /></Screen>;
  }

  async function confirmReceived() {
    if (!req) return;
    setConfirming(true);
    const { error } = await supabase.functions.invoke('confirm-delivery', { body: { requestId: req.id } });
    setConfirming(false);
    if (error) return Alert.alert('Could not confirm', error.message);
  }

  function reportRunner() {
    // Phone numbers never exposed publicly (spec §11.4). Contact via report-a-problem.
    if (!req?.runner_id) return;
    router.push({ pathname: '/(app)/(shared)/report', params: { reportedId: req.runner_id, requestId: req.id } } as any);
  }

  function callDriver() {
    if (!req?.driver_phone) return;
    Linking.openURL(`tel:${req.driver_phone}`);
  }

  async function raiseDispute() {
    router.push(`/(app)/(shared)/dispute/${req!.id}` as any);
  }

  const milestones = buildRequesterMilestones(req);
  const isDelivered = req.status === 'delivered';
  const isOpen = req.status === 'open';
  const isActive = ['matched', 'items_purchased', 'in_transit'].indexOf(req.status) >= 0;
  const minSincePosted = req.posted_at ? (Date.now() - new Date(req.posted_at).getTime()) / 60000 : 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.sm }]}>Your errand</Text>
      <Text style={[type.caption, { color: c.textMuted, marginBottom: spacing.lg }]}>
        {req.pickup_location} → {req.delivery_address}
      </Text>

      <MilestoneTimeline milestones={milestones} />

      {/* Call buttons — always visible during active transactions.
          Runner phone is private (spec §11.4). Driver phone is shared once handoff occurs. */}
      {isActive && (
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          <View style={{ flex: 1 }}>
            <Button label="Report Runner" variant="secondary" onPress={reportRunner} />
          </View>
          {req.driver_phone ? (
            <View style={{ flex: 1 }}>
              <Button label="Call Driver" variant="secondary" onPress={callDriver} />
            </View>
          ) : null}
        </View>
      )}

      {/* Confirm received */}
      {req.status === 'in_transit' && (
        <Button
          label="Confirm Received"
          onPress={confirmReceived}
          loading={confirming}
          style={{ marginTop: spacing.lg }}
        />
      )}

      {/* Raise offer + Cancel when still searching for a Runner (after 30 min) */}
      {isOpen && minSincePosted >= 30 && (
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Button label="Raise offer" onPress={() => router.push(`/(app)/(requester)/raise-offer/${req.id}` as any)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Cancel" variant="danger" onPress={() => router.push(`/(app)/(requester)/cancel/${req.id}` as any)} />
          </View>
        </View>
      )}

      {/* Cancel when open and runner not yet assigned, before 30 min */}
      {isOpen && minSincePosted < 30 && (
        <Button label="Cancel request" variant="secondary" onPress={() => router.push(`/(app)/(requester)/cancel/${req.id}` as any)} style={{ marginTop: spacing.lg }} />
      )}

      {/* Cancel after Runner accepts (partial refund) */}
      {(req.status === 'matched' || req.status === 'items_purchased') && (
        <Button label="Cancel request" variant="secondary" onPress={() => router.push(`/(app)/(requester)/cancel/${req.id}` as any)} style={{ marginTop: spacing.md }} />
      )}

      {/* Dispute button — only after delivered or during in_transit per spec §8.5 */}
      {(req.status === 'in_transit' || isDelivered) && (
        <Button
          label="Raise Dispute"
          variant="danger"
          onPress={raiseDispute}
          style={{ marginTop: spacing.md }}
        />
      )}

      {/* Rating after delivery */}
      {isDelivered && req.runner_id && !rated && (
        <View style={{ marginTop: spacing.xl }}>
          <RatingCard
            label={`Rate ${req.runner?.full_name ?? 'your Runner'}`}
            onRate={async (stars) => {
              await submitRating({ requestId: req.id, ratedId: req.runner_id!, stars });
              setRated(true);
            }}
          />
        </View>
      )}

      {rated && (
        <Text style={[type.caption, { color: c.textMuted, textAlign: 'center', marginTop: spacing.lg }]}>
          Rating saved. Thanks!
        </Text>
      )}
    </ScrollView>
  );
}

function buildRequesterMilestones(req: any): Milestone[] {
  const ts = req.milestone_timestamps ?? {};
  const s: string = req.status;

  const steps: { key: string; label: string; description?: string }[] = [
    { key: 'matched', label: 'Accepted', description: req.runner?.full_name ? `${req.runner.full_name} is heading to ${req.pickup_location}.` : undefined },
    { key: 'at_market', label: 'At market' },
    { key: 'items_purchased', label: 'Items purchased', description: 'Photo attached below.' },
    { key: 'in_transit', label: 'Handed to driver', description: req.taxi_plate ? `Taxi ${req.taxi_plate}` : undefined },
    { key: 'en_route', label: 'En route' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const order = steps.map((s) => s.key);
  const currentIndex = s === 'delivered' ? 5 : s === 'in_transit' ? 3 : s === 'items_purchased' ? 2 : s === 'matched' ? 0 : -1;

  return steps.map((step, i) => ({
    number: i + 1,
    label: step.label,
    description: step.description,
    status: i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending',
    timestamp: ts[step.key] ?? null,
    photoUrl:
      step.key === 'items_purchased' ? req.photo_items_url :
      step.key === 'in_transit' ? req.photo_handoff_url : null,
    requiredPhoto: step.key === 'items_purchased' || step.key === 'in_transit',
  }));
}
