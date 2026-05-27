import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, EmptyState, Screen, SkeletonCard, StatusDot } from '@/components/ui';
import { useActiveRequesterRequest } from '@/hooks/useRequest';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';
import { assertTapDepth } from '@/lib/threeTap';

const STATUS_DOT: Record<string, 'progress' | 'success' | 'problem' | 'idle'> = {
  open: 'idle',
  matched: 'progress',
  items_purchased: 'progress',
  in_transit: 'progress',
  delivered: 'success',
  disputed: 'problem',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Looking for a Runner…',
  matched: 'Runner heading to market',
  items_purchased: 'Items bought — on the way',
  in_transit: 'In transit',
  delivered: 'Delivered!',
  disputed: 'Dispute open',
};

export default function RequesterHome() {
  const { c, type, spacing, radius, tapTarget } = useTheme();
  const profile = useAuth((s) => s.profile);
  const { data: activeRequest, isLoading } = useActiveRequesterRequest(profile?.id ?? null);

  useEffect(() => {
    assertTapDepth('requester.home->post', 1);
    assertTapDepth('requester.home->active', 1);
  }, []);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={[type.h1, { color: c.text, marginBottom: spacing.lg }]}>Your errands</Text>

        {isLoading ? (
          <SkeletonCard />
        ) : activeRequest ? (
          <Card
            onPress={() => router.push(`/(app)/(requester)/request/${activeRequest.id}` as any)}
            style={{ marginBottom: spacing.lg }}
          >
            <StatusDot
              status={STATUS_DOT[activeRequest.status] ?? 'idle'}
              label={STATUS_LABEL[activeRequest.status] ?? activeRequest.status}
            />
            <Text style={[type.bodyStrong, { color: c.text, marginTop: spacing.sm }]}>
              {activeRequest.pickup_location} → {activeRequest.delivery_address}
            </Text>
            <Text style={[type.caption, { color: c.textMuted, marginTop: 4 }]}>
              {(activeRequest.item_list as string[]).slice(0, 2).join(', ')}
              {(activeRequest.item_list as string[]).length > 2 ? ` +${(activeRequest.item_list as string[]).length - 2} more` : ''}
            </Text>
            <Text style={[type.caption, { color: c.primary, marginTop: 4 }]}>Tap to track →</Text>
          </Card>
        ) : (
          <EmptyState title="No active errands" body="Tap the orange button to post one." />
        )}
      </ScrollView>

      {/* Orange FAB — Tap 1 of 3-tap post flow */}
      <Pressable
        accessibilityLabel="Post a new request"
        onPress={() => router.push('/(app)/(requester)/new-request' as any)}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: c.primary,
            borderRadius: radius.pill,
            width: tapTarget.min + 16,
            height: tapTarget.min + 16,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={{ color: c.primaryFg, fontSize: 36, lineHeight: 40, fontWeight: '300' }}>+</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', right: 24, bottom: 24,
    alignItems: 'center', justifyContent: 'center', elevation: 6,
  },
});
