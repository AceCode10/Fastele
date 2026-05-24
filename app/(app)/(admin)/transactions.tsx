import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { Card, EmptyState, Screen, StatusDot } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/lib/theme';
import { formatDistanceToNow } from 'date-fns';

function useActiveTransactions() {
  return useQuery({
    queryKey: ['admin', 'transactions'],
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('requests')
        .select(`
          id, status, pickup_location, delivery_address, accepted_at, created_at,
          requester:users!requester_id(full_name),
          runner:users!runner_id(full_name)
        `)
        .in('status', ['open', 'matched', 'items_purchased', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
}

const STATUS_COLOR: Record<string, 'success' | 'progress' | 'problem' | 'idle'> = {
  open: 'idle', matched: 'progress', items_purchased: 'progress', in_transit: 'progress',
};

export default function AdminTransactions() {
  const { c, type, spacing } = useTheme();
  const { data, isLoading, refetch } = useActiveTransactions();

  const stuckThreshold = 3 * 60 * 60 * 1000; // 3 hours per spec §13
  const now = Date.now();

  return (
    <Screen padded={false}>
      <View style={{ padding: spacing.lg }}>
        <Text style={[type.h1, { color: c.text }]}>Live transactions</Text>
        <Text style={[type.caption, { color: c.textMuted }]}>Flags anything stuck over 3 hours.</Text>
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(i) => i.id}
        onRefresh={refetch}
        refreshing={isLoading}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        ListEmptyComponent={!isLoading ? <EmptyState title="No active transactions" /> : null}
        renderItem={({ item }) => {
          const age = now - new Date(item.accepted_at ?? item.created_at).getTime();
          const stuck = item.status !== 'open' && age > stuckThreshold;
          return (
            <Card style={{ marginBottom: spacing.sm, borderColor: stuck ? c.accent : c.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <StatusDot status={STATUS_COLOR[item.status] ?? 'idle'} label={item.status.replace(/_/g, ' ')} />
                {stuck && <Text style={[type.caption, { color: c.accent }]}>STUCK</Text>}
              </View>
              <Text style={[type.bodyStrong, { color: c.text, marginTop: 4 }]}>{item.pickup_location}</Text>
              <Text style={[type.caption, { color: c.textMuted }]}>
                {item.requester?.full_name} → {item.runner?.full_name ?? 'no runner'}
              </Text>
              <Text style={[type.caption, { color: c.textMuted }]}>
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </Text>
            </Card>
          );
        }}
      />
    </Screen>
  );
}
