import React, { useState } from 'react';
import { Alert, FlatList, Image, Text, TextInput, View } from 'react-native';
import { Button, Card, EmptyState, Screen } from '@/components/ui';
import { useAdminDisputes } from '@/hooks/useAdmin';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

function DisputeCard({ item, adminId }: { item: any; adminId: string | null }) {
  const { c, type, spacing } = useTheme();
  const [refundAmt, setRefundAmt] = useState('');
  const [busy, setBusy] = useState(false);

  async function rule(ruling: 'full_refund' | 'partial_refund' | 'no_refund') {
    setBusy(true);
    const refundAmount = ruling === 'full_refund'
      ? item.request?.runner_fee
      : ruling === 'partial_refund'
      ? parseFloat(refundAmt) || 0
      : 0;

    const { error } = await supabase.functions.invoke('resolve-dispute', {
      body: { disputeId: item.id, ruling, refundAmount, adminId },
    });
    setBusy(false);
    if (error) Alert.alert('Failed', error.message);
  }

  const req = item.request;
  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <Text style={[type.bodyStrong, { color: c.text }]}>{item.reason.replace(/_/g, ' ')}</Text>
      <Text style={[type.caption, { color: c.textMuted }]}>
        {req?.requester?.full_name} vs {req?.runner?.full_name}
      </Text>
      {item.description ? (
        <Text style={[type.body, { color: c.text, marginTop: spacing.sm }]}>{item.description}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
        {req?.photo_items_url ? <Image source={{ uri: req.photo_items_url }} style={{ flex: 1, height: 120, borderRadius: 8 }} resizeMode="cover" /> : null}
        {item.evidence_signed_url ? <Image source={{ uri: item.evidence_signed_url }} style={{ flex: 1, height: 120, borderRadius: 8 }} resizeMode="cover" /> : null}
      </View>

      {item.runner_response ? (
        <View style={{ marginTop: spacing.md, backgroundColor: c.surfaceAlt, borderRadius: 8, padding: 10 }}>
          <Text style={[type.caption, { color: c.textMuted }]}>Runner response:</Text>
          <Text style={[type.body, { color: c.text }]}>{item.runner_response}</Text>
        </View>
      ) : null}

      <TextInput
        placeholder="Partial refund amount (K)"
        placeholderTextColor={c.textMuted}
        keyboardType="numeric"
        value={refundAmt}
        onChangeText={setRefundAmt}
        style={{ backgroundColor: c.surfaceAlt, borderRadius: 8, padding: 10, color: c.text, marginTop: spacing.md, minHeight: 44 }}
      />

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <Button label="Full refund" variant="danger" onPress={() => rule('full_refund')} loading={busy} style={{ flex: 1 }} />
        <Button label="Partial" variant="secondary" onPress={() => rule('partial_refund')} loading={busy} style={{ flex: 1 }} />
        <Button label="Runner wins" onPress={() => rule('no_refund')} loading={busy} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

export default function AdminDisputes() {
  const { c, type, spacing } = useTheme();
  const { data, isLoading, refetch } = useAdminDisputes();
  const adminId = useAuth((s) => s.userId);

  return (
    <Screen padded={false}>
      <View style={{ padding: spacing.lg }}>
        <Text style={[type.h1, { color: c.text }]}>Disputes</Text>
        <Text style={[type.caption, { color: c.textMuted }]}>{data?.length ?? 0} open</Text>
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        onRefresh={refetch}
        refreshing={isLoading}
        ListEmptyComponent={!isLoading ? <EmptyState title="No open disputes" body="All resolved." /> : null}
        renderItem={({ item }) => <DisputeCard item={item} adminId={adminId} />}
      />
    </Screen>
  );
}
