import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, Screen, SkeletonCard, StatusDot } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

export default function Earnings() {
  const { c, type, spacing } = useTheme();
  const userId = useAuth((s) => s.userId);

  const { data, isLoading } = useQuery({
    queryKey: ['earnings', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('requests')
        .select('id, status, pickup_location, delivery_address, runner_fee, platform_fee, item_budget, posted_at, delivered_at, completed_at, payout_reference')
        .eq('runner_id', userId)
        .in('status', ['delivered', 'disputed', 'cancelled'])
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = React.useMemo(() => {
    if (!data) return { total: 0, count: 0, thisMonth: 0 };
    let total = 0;
    let thisMonth = 0;
    const now = new Date();
    for (const r of data as any[]) {
      if (r.status !== 'delivered') continue;
      const net = Number(r.runner_fee ?? 0) - Number(r.platform_fee ?? 0);
      total += net;
      const d = r.completed_at ? new Date(r.completed_at) : null;
      if (d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        thisMonth += net;
      }
    }
    return { total, count: (data as any[]).filter((r: any) => r.status === 'delivered').length, thisMonth };
  }, [data]);

  function fmt(d: string | null) {
    if (!d) return '';
    return new Date(d).toLocaleDateString();
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Text style={[type.h1, { color: c.text, marginBottom: spacing.md }]}>Earnings</Text>

        <Card style={{ marginBottom: spacing.md, backgroundColor: c.primary }}>
          <Text style={[type.caption, { color: c.primaryFg, opacity: 0.85 }]}>This month</Text>
          <Text style={[type.h1, { color: c.primaryFg, marginTop: 4 }]}>K{totals.thisMonth.toFixed(0)}</Text>
          <Text style={[type.caption, { color: c.primaryFg, opacity: 0.85, marginTop: 4 }]}>
            All-time: K{totals.total.toFixed(0)} · {totals.count} deliveries
          </Text>
        </Card>
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : !data || data.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <EmptyState title="No earnings yet" body="Accept jobs from the Feed to start earning." />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(r: any) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          renderItem={({ item }: { item: any }) => {
            const net = Number(item.runner_fee ?? 0) - Number(item.platform_fee ?? 0);
            return (
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <StatusDot
                    status={item.status === 'delivered' ? 'success' : item.status === 'cancelled' ? 'problem' : 'progress'}
                    label={item.status === 'delivered' ? 'Paid' : item.status === 'cancelled' ? 'Cancelled' : 'Disputed'}
                  />
                  <Text style={[type.caption, { color: c.textMuted }]}>{fmt(item.completed_at ?? item.delivered_at ?? item.posted_at)}</Text>
                </View>
                <Text style={[type.bodyStrong, { color: c.text, marginTop: spacing.sm }]}>
                  {item.pickup_location} → {item.delivery_address}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                  <Text style={[type.caption, { color: c.textMuted }]}>
                    Fee K{Number(item.runner_fee).toFixed(0)} − fee K{Number(item.platform_fee ?? 0).toFixed(0)}
                  </Text>
                  <Text style={[type.bodyStrong, { color: item.status === 'delivered' ? c.success : c.textMuted }]}>
                    {item.status === 'delivered' ? `+K${net.toFixed(0)}` : '—'}
                  </Text>
                </View>
                {item.payout_reference && (
                  <Text style={[type.caption, { color: c.textMuted, marginTop: 4 }]}>Ref: {item.payout_reference}</Text>
                )}
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}
