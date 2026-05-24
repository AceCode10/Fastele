import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function UserSearch() {
  const { c, type, spacing, radius } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    const q = query.trim();
    const { data } = await (supabase as any)
      .from('users')
      .select('id, full_name, phone_number, is_runner_verified, is_suspended, is_banned, runner_rating_avg, requester_rating_avg, created_at')
      .or(`phone_number.ilike.%${q}%,full_name.ilike.%${q}%`)
      .limit(20);
    setResults(data ?? []);
    setBusy(false);
  }

  return (
    <Screen scroll>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.lg }]}>User search</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        <TextInput
          placeholder="Phone or name"
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
          style={{ flex: 1, backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: 12, color: c.text, minHeight: 48 }}
        />
        <Button label="Search" onPress={search} loading={busy} fullWidth={false} />
      </View>

      {results.map((u) => (
        <Card key={u.id} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={[type.bodyStrong, { color: c.text }]}>{u.full_name}</Text>
              <Text style={[type.caption, { color: c.textMuted }]}>{u.phone_number}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {u.is_banned && <Text style={[type.caption, { color: c.danger }]}>BANNED</Text>}
              {u.is_suspended && !u.is_banned && <Text style={[type.caption, { color: c.warning }]}>Suspended</Text>}
              {u.is_runner_verified && <Text style={[type.caption, { color: c.success }]}>Verified runner</Text>}
            </View>
          </View>
          <Text style={[type.caption, { color: c.textMuted, marginTop: 4 }]}>
            Runner ★{u.runner_rating_avg?.toFixed(1) ?? '—'} | Requester ★{u.requester_rating_avg?.toFixed(1) ?? '—'}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
