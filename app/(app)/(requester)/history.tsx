import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, Screen, SkeletonCard, StatusDot } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  matched: 'Matched',
  items_purchased: 'Items bought',
  in_transit: 'In transit',
  delivered: 'Delivered',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const STATUS_DOT: Record<string, 'progress' | 'success' | 'problem' | 'idle'> = {
  open: 'idle', matched: 'progress', items_purchased: 'progress', in_transit: 'progress',
  delivered: 'success', disputed: 'problem', cancelled: 'problem', expired: 'problem',
};

export default function History() {
  const { c, type, spacing } = useTheme();
  const userId = useAuth((s) => s.userId);

  const { data, isLoading } = useQuery({
    queryKey: ['history-requester', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('requests')
        .select('id, status, pickup_location, delivery_address, item_list, item_budget, runner_fee, posted_at, delivered_at, completed_at')
        .eq('requester_id', userId)
        .in('status', ['delivered', 'cancelled', 'expired', 'disputed'])
        .order('posted_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  function fmt(d: string | null) {
    if (!d) return '';
    return new Date(d).toLocaleDateString();
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Text style={[type.h1, { color: c.text, marginBottom: spacing.md }]}>History</Text>
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : !data || data.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <EmptyState title="No past errands" body="Completed requests will show here." />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(r: any) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          renderItem={({ item }: { item: any }) => (
            <Card
              onPress={() => router.push(`/(app)/(requester)/request/${item.id}` as any)}
              style={{ marginBottom: spacing.sm }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusDot status={STATUS_DOT[item.status] ?? 'idle'} label={STATUS_LABEL[item.status] ?? item.status} />
                <Text style={[type.caption, { color: c.textMuted }]}>{fmt(item.delivered_at ?? item.completed_at ?? item.posted_at)}</Text>
              </View>
              <Text style={[type.bodyStrong, { color: c.text, marginTop: spacing.sm }]}>
                {item.pickup_location} → {item.delivery_address}
              </Text>
              <Text style={[type.caption, { color: c.textMuted, marginTop: 4 }]}>
                {(item.item_list as string[]).slice(0, 2).join(', ')}
                {(item.item_list as string[]).length > 2 ? ` +${(item.item_list as string[]).length - 2} more` : ''}
              </Text>
              <Text style={[type.caption, { color: c.text, marginTop: 4 }]}>
                K{(Number(item.item_budget ?? 0) + Number(item.runner_fee ?? 0)).toFixed(0)} total
              </Text>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
