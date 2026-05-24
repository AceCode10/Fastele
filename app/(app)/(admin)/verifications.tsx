import React from 'react';
import { Alert, FlatList, Image, Text, View } from 'react-native';
import { Button, Card, EmptyState, Screen } from '@/components/ui';
import { usePendingVerifications, useVerificationAction } from '@/hooks/useAdmin';
import { useTheme } from '@/lib/theme';

function VerificationCard({ item }: { item: any }) {
  const { c, type, spacing } = useTheme();
  const { mutate: action, isPending } = useVerificationAction();

  function approve() {
    Alert.alert('Approve?', `Verify ${item.full_name} as Runner?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => action({ userId: item.id, approve: true }) },
    ]);
  }
  function reject() {
    Alert.alert('Reject?', `This blocks ${item.full_name} from accepting jobs.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => action({ userId: item.id, approve: false }) },
    ]);
  }

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <Text style={[type.bodyStrong, { color: c.text }]}>{item.full_name}</Text>
      <Text style={[type.caption, { color: c.textMuted }]}>{item.phone_number}</Text>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: c.textMuted, marginBottom: 4 }]}>NRC</Text>
          {item.nrc_signed_url
            ? <Image source={{ uri: item.nrc_signed_url }} style={{ width: '100%', height: 140, borderRadius: 8 }} resizeMode="cover" />
            : <Text style={[type.caption, { color: c.textMuted }]}>No photo</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: c.textMuted, marginBottom: 4 }]}>Selfie</Text>
          {item.selfie_signed_url
            ? <Image source={{ uri: item.selfie_signed_url }} style={{ width: '100%', height: 140, borderRadius: 8 }} resizeMode="cover" />
            : <Text style={[type.caption, { color: c.textMuted }]}>No selfie</Text>}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button label="Approve" onPress={approve} loading={isPending} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Reject" variant="danger" onPress={reject} loading={isPending} />
        </View>
      </View>
    </Card>
  );
}

export default function Verifications() {
  const { c, type, spacing } = useTheme();
  const { data, isLoading, refetch } = usePendingVerifications();

  return (
    <Screen padded={false}>
      <View style={{ padding: spacing.lg }}>
        <Text style={[type.h1, { color: c.text }]}>Verification queue</Text>
        <Text style={[type.caption, { color: c.textMuted }]}>{data?.length ?? 0} pending</Text>
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        onRefresh={refetch}
        refreshing={isLoading}
        ListEmptyComponent={!isLoading ? <EmptyState title="Queue clear" body="No pending verifications." /> : null}
        renderItem={({ item }) => <VerificationCard item={item} />}
      />
    </Screen>
  );
}
