import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, StatusDot } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

// Unified profile. Spec §9.3.

export default function Profile() {
  const { c, type, spacing } = useTheme();
  const profile = useAuth((s) => s.profile);
  const userId = useAuth((s) => s.userId);
  const signOut = useAuth((s) => s.signOut);

  const { data: stats } = useQuery({
    queryKey: ['profile-stats', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ count: requesterCount }, { count: runnerCount }] = await Promise.all([
        (supabase as any).from('requests').select('id', { count: 'exact', head: true }).eq('requester_id', userId).eq('status', 'delivered'),
        (supabase as any).from('requests').select('id', { count: 'exact', head: true }).eq('runner_id', userId).eq('status', 'delivered'),
      ]);
      return { requesterCount: requesterCount ?? 0, runnerCount: runnerCount ?? 0 };
    },
  });

  if (!profile) return null;

  const reqRating = profile.requester_rating_avg;
  const runRating = profile.runner_rating_avg;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.lg }]}>Profile</Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.h2, { color: c.text }]}>{profile.full_name}</Text>
        <Text style={[type.caption, { color: c.textMuted, marginTop: 4 }]}>Member · {profile.phone_number}</Text>
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.sm }]}>As Requester</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={[type.caption, { color: c.textMuted }]}>Rating</Text>
            <Text style={[type.h2, { color: c.text }]}>{reqRating ? `★ ${reqRating.toFixed(1)}` : '—'}</Text>
          </View>
          <View>
            <Text style={[type.caption, { color: c.textMuted }]}>Completed</Text>
            <Text style={[type.h2, { color: c.text }]}>{stats?.requesterCount ?? '—'}</Text>
          </View>
        </View>
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={[type.bodyStrong, { color: c.text }]}>As Runner</Text>
          <StatusDot
            status={profile.is_runner_verified ? 'success' : 'idle'}
            label={profile.is_runner_verified ? 'Verified' : 'Unverified'}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={[type.caption, { color: c.textMuted }]}>Rating</Text>
            <Text style={[type.h2, { color: c.text }]}>{runRating ? `★ ${runRating.toFixed(1)}` : '—'}</Text>
            <Text style={[type.caption, { color: c.textMuted, marginTop: 2 }]}>{profile.runner_rating_count ?? 0} ratings</Text>
          </View>
          <View>
            <Text style={[type.caption, { color: c.textMuted }]}>Deliveries</Text>
            <Text style={[type.h2, { color: c.text }]}>{stats?.runnerCount ?? '—'}</Text>
          </View>
        </View>
        {!profile.is_runner_verified && (
          <Button
            label="Verify as Runner"
            variant="secondary"
            onPress={() => router.push('/(app)/runner-verify' as any)}
            style={{ marginTop: spacing.md }}
          />
        )}
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Button label="Wallet" variant="secondary" onPress={() => router.push('/(app)/(shared)/wallet' as any)} />
        <Button label="Settings" variant="secondary" onPress={() => router.push('/(app)/(shared)/settings' as any)} />
        <Button label="Help & Support" variant="secondary" onPress={() => router.push('/(app)/(shared)/help' as any)} />
        <Button label="Sign out" variant="danger" onPress={() => signOut()} style={{ marginTop: spacing.lg }} />
      </View>
    </ScrollView>
  );
}
