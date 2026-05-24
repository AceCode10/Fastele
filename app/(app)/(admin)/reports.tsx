import React from 'react';
import { Alert, FlatList, Image, Text, View } from 'react-native';
import { Button, Card, EmptyState, Screen } from '@/components/ui';
import { useAdminReports, useReportAction } from '@/hooks/useAdmin';
import { useTheme } from '@/lib/theme';

function ReportCard({ item }: { item: any }) {
  const { c, type, spacing } = useTheme();
  const { mutate: action, isPending } = useReportAction();

  function apply(outcome: 'warning' | 'suspension' | 'ban' | 'dismissed') {
    Alert.alert(`${outcome.charAt(0).toUpperCase() + outcome.slice(1)}?`,
      `Apply ${outcome} to ${item.reported?.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: outcome === 'dismissed' ? 'default' : 'destructive',
          onPress: () => action({ reportId: item.id, reportedId: item.reported?.id, outcome }) },
      ]
    );
  }

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <Text style={[type.bodyStrong, { color: c.text }]}>{item.reason.replace(/_/g, ' ')}</Text>
      <Text style={[type.caption, { color: c.textMuted }]}>
        {item.reporter?.full_name} reported {item.reported?.full_name}
      </Text>
      {item.description ? <Text style={[type.body, { color: c.text, marginTop: spacing.sm }]}>{item.description}</Text> : null}
      {item.evidence_signed_url ? <Image source={{ uri: item.evidence_signed_url }} style={{ width: '100%', height: 140, borderRadius: 8, marginTop: spacing.md }} resizeMode="cover" /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
        <Button label="Warn" variant="secondary" onPress={() => apply('warning')} loading={isPending} style={{ flex: 1 }} />
        <Button label="Suspend" variant="danger" onPress={() => apply('suspension')} loading={isPending} style={{ flex: 1 }} />
        <Button label="Ban" variant="danger" onPress={() => apply('ban')} loading={isPending} style={{ flex: 1 }} />
        <Button label="Dismiss" variant="ghost" onPress={() => apply('dismissed')} loading={isPending} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

export default function AdminReports() {
  const { c, type, spacing } = useTheme();
  const { data, isLoading, refetch } = useAdminReports();

  return (
    <Screen padded={false}>
      <View style={{ padding: spacing.lg }}>
        <Text style={[type.h1, { color: c.text }]}>Reports</Text>
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        onRefresh={refetch}
        refreshing={isLoading}
        ListEmptyComponent={!isLoading ? <EmptyState title="No pending reports" /> : null}
        renderItem={({ item }) => <ReportCard item={item} />}
      />
    </Screen>
  );
}
