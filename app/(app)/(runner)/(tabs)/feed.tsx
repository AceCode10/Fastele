import React, { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, EmptyState, Screen, SkeletonCard, StatusDot } from '@/components/ui';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/stores/authStore';
import { useFeed, useActiveRunnerJob } from '@/hooks/useFeed';
import { assertTapDepth } from '@/lib/threeTap';

function formatKwacha(n: number) { return `K${n.toFixed(0)}`; }

function RequestCard({ item }: { item: any }) {
  const { c, type, spacing, radius, tapTarget } = useTheme();
  const itemSummary: string[] = item.item_list?.slice(0, 2) ?? [];
  const more = (item.item_list?.length ?? 0) - 2;

  return (
    <Card onPress={() => router.push(`/(app)/runner-request/${item.id}` as any)} style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: spacing.md }}>
          <Text style={[type.bodyStrong, { color: c.text }]} numberOfLines={1}>{item.pickup_location}</Text>
          <Text style={[type.caption, { color: c.textMuted, marginTop: 2 }]} numberOfLines={1}>{item.delivery_address}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[type.h3, { color: c.primary }]}>{formatKwacha(item.runner_fee)}</Text>
          <Text style={[type.caption, { color: c.textMuted }]}>+ items K{item.item_budget}</Text>
        </View>
      </View>

      <View style={{ marginTop: spacing.sm }}>
        {itemSummary.map((it: string, i: number) => (
          <Text key={i} style={[type.caption, { color: c.text }]}>• {it}</Text>
        ))}
        {more > 0 && <Text style={[type.caption, { color: c.textMuted }]}>+{more} more items</Text>}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
        <StatusDot status="progress" label="Open" />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {item.requester?.requester_rating_avg && item.requester.requester_rating_count >= 5 ? (
            <Text style={[type.caption, { color: c.textMuted }]}>★ {item.requester.requester_rating_avg.toFixed(1)} requester</Text>
          ) : (
            <Text style={[type.caption, { color: c.textMuted }]}>New requester</Text>
          )}
        </View>
      </View>
    </Card>
  );
}

export default function RunnerFeed() {
  const { c, type, spacing } = useTheme();
  const profile = useAuth((s) => s.profile);
  const { data: jobs, isLoading, refetch } = useFeed();
  const { data: activeJob } = useActiveRunnerJob(profile?.id ?? null);

  useEffect(() => { assertTapDepth('runner.feed->accept', 2); }, []);

  if (profile && !profile.is_runner_verified) {
    return (
      <Screen>
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[type.h3, { color: c.text }]}>Verify your ID to accept jobs</Text>
          <Text style={[type.body, { color: c.textMuted, marginTop: 6, marginBottom: spacing.md }]}>
            Upload your NRC and a selfie. Approval usually under 24 hours.
          </Text>
          <Text onPress={() => router.push('/(app)/runner-verify' as any)} style={[type.bodyStrong, { color: c.primary }]}>
            Verify Now →
          </Text>
        </Card>
        <EmptyState title="Browse-only mode" body="You can see jobs but can't accept until verified." />
      </Screen>
    );
  }

  if (activeJob) {
    return (
      <Screen>
        <Text style={[type.h1, { color: c.text, marginBottom: spacing.lg }]}>Live errands</Text>
        <Card onPress={() => router.push('/(app)/(runner)/active-job' as any)} style={{ marginBottom: spacing.lg }}>
          <StatusDot status="progress" label="Active job in progress" />
          <Text style={[type.bodyStrong, { color: c.text, marginTop: spacing.sm }]}>{activeJob.pickup_location}</Text>
          <Text style={[type.caption, { color: c.textMuted }]}>Tap to continue →</Text>
        </Card>
        <EmptyState title="Feed locked" body="Complete your current job to browse new ones." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={[type.h1, { color: c.text }]}>Live errands</Text>
        <Text style={[type.caption, { color: c.textMuted }]}>Higher rating = faster access to new jobs.</Text>
      </View>
      <FlatList
        data={jobs ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={c.primary} />}
        ListEmptyComponent={
          isLoading
            ? <>{[1,2,3].map(i => <SkeletonCard key={i} />)}</>
            : <EmptyState title="No open jobs right now" body="Pull to refresh. New jobs appear automatically." />
        }
        renderItem={({ item }) => <RequestCard item={item} />}
      />
    </Screen>
  );
}
