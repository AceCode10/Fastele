import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui';
import { usePlatformStats } from '@/hooks/useAdmin';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTheme } from '@/lib/theme';

function StatTile({ label, value, color }: { label: string; value: number | null; color?: string }) {
  const { c, type, spacing, radius } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: spacing.lg }]}>
      <Text style={[type.h1, { color: color ?? c.primary }]}>{value ?? '—'}</Text>
      <Text style={[type.caption, { color: c.textMuted, marginTop: 4 }]}>{label}</Text>
    </View>
  );
}

function NavLink({ label, href, badge }: { label: string; href: string; badge?: number }) {
  const { c, type, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(href as any)}
      style={({ pressed }) => [styles.link, { backgroundColor: c.surface, borderColor: c.border, borderRadius: radius.md, padding: spacing.lg, opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={[type.bodyStrong, { color: c.text }]}>{label}</Text>
      {badge ? <View style={[styles.badge, { backgroundColor: c.accent }]}><Text style={{ color: '#fff', fontSize: 12 }}>{badge}</Text></View> : null}
    </Pressable>
  );
}

export default function AdminHome() {
  const { c, type, spacing } = useTheme();
  const { data: stats } = usePlatformStats();
  const { isSuperAdmin } = useIsAdmin();

  return (
    <Screen scroll>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.lg }]}>Admin</Text>

      <View style={styles.grid}>
        <StatTile label="Requests today" value={stats?.totalToday ?? null} />
        <StatTile label="Active now" value={stats?.activeNow ?? null} color={stats?.activeNow ? undefined : '#999'} />
        <StatTile label="Open disputes" value={stats?.disputes ?? null} color={stats?.disputes ? '#EB1700' : '#999'} />
        <StatTile label="Verify queue" value={stats?.newRunners ?? null} color={stats?.newRunners ? '#F5A623' : '#999'} />
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <NavLink label="Verification queue" href="/(app)/(admin)/verifications" badge={stats?.newRunners} />
        <NavLink label="Disputes" href="/(app)/(admin)/disputes" badge={stats?.disputes} />
        <NavLink label="Reports" href="/(app)/(admin)/reports" />
        <NavLink label="User search" href="/(app)/(admin)/users" />
        <NavLink label="Live transactions" href="/(app)/(admin)/transactions" />
        {isSuperAdmin && <NavLink label="Platform config" href="/(app)/(admin)/config" />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flex: 1, minWidth: '45%' },
  link: { borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
});
