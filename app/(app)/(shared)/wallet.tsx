import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, EmptyState } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

// Wallet — escrow balance, lifetime totals, recent ledger entries.
// MVP: read-only summary. Top-up/withdraw routed to existing Airtel flows.

export default function Wallet() {
  const { c, type, spacing } = useTheme();
  const userId = useAuth((s) => s.userId);

  const { data, isLoading } = useQuery({
    queryKey: ['wallet', userId],
    enabled: !!userId,
    queryFn: async () => {
      // Pending escrow = open + in_progress requests where user is requester.
      const [{ data: pending }, { data: earned }, { data: spent }] = await Promise.all([
        (supabase as any).from('requests')
          .select('item_budget, runner_fee')
          .eq('requester_id', userId)
          .in('status', ['open', 'matched', 'items_purchased', 'in_transit', 'disputed']),
        (supabase as any).from('requests')
          .select('runner_fee, platform_fee')
          .eq('runner_id', userId)
          .eq('status', 'delivered'),
        (supabase as any).from('requests')
          .select('item_budget, runner_fee')
          .eq('requester_id', userId)
          .eq('status', 'delivered'),
      ]);
      const pendingTotal = (pending ?? []).reduce((s: number, r: any) => s + Number(r.item_budget ?? 0) + Number(r.runner_fee ?? 0), 0);
      const earnedTotal = (earned ?? []).reduce((s: number, r: any) => s + (Number(r.runner_fee ?? 0) - Number(r.platform_fee ?? 0)), 0);
      const spentTotal = (spent ?? []).reduce((s: number, r: any) => s + Number(r.item_budget ?? 0) + Number(r.runner_fee ?? 0), 0);
      return { pendingTotal, earnedTotal, spentTotal };
    },
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.lg }]}>Wallet</Text>

      <Card style={{ marginBottom: spacing.lg, backgroundColor: c.primary }}>
        <Text style={[type.caption, { color: c.primaryFg, opacity: 0.85 }]}>Held in escrow</Text>
        <Text style={[type.h1, { color: c.primaryFg, marginTop: 4 }]}>
          K{data?.pendingTotal?.toFixed(2) ?? '0.00'}
        </Text>
        <Text style={[type.caption, { color: c.primaryFg, opacity: 0.85, marginTop: 4 }]}>
          Releases to Runner on delivery confirmation.
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
        <Card style={{ flex: 1 }}>
          <Text style={[type.caption, { color: c.textMuted }]}>Earned (Runner)</Text>
          <Text style={[type.h2, { color: c.success, marginTop: 4 }]}>
            K{data?.earnedTotal?.toFixed(0) ?? '0'}
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={[type.caption, { color: c.textMuted }]}>Spent (Requester)</Text>
          <Text style={[type.h2, { color: c.text, marginTop: 4 }]}>
            K{data?.spentTotal?.toFixed(0) ?? '0'}
          </Text>
        </Card>
      </View>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.sm }]}>How payouts work</Text>
        <Text style={[type.body, { color: c.textMuted }]}>
          Requesters pay via Airtel Money STK push when posting a request. Funds sit in escrow until delivery is confirmed, then the platform pays the Runner directly to their Airtel number. No in-app withdrawal needed.
        </Text>
      </Card>

      {!isLoading && (data?.pendingTotal ?? 0) === 0 && (data?.earnedTotal ?? 0) === 0 && (data?.spentTotal ?? 0) === 0 && (
        <EmptyState title="No activity yet" body="Post a request or accept a job to see your wallet activity." />
      )}

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Button label="View transaction history" variant="secondary" onPress={() => router.push('/(app)/(requester)/history' as any)} />
      </View>
    </ScrollView>
  );
}
