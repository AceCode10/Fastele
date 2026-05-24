import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

export type MilestoneStatus = 'done' | 'active' | 'pending';

export type Milestone = {
  number: number;
  label: string;
  description?: string;
  status: MilestoneStatus;
  timestamp?: string | null;
  photoUrl?: string | null;
  /** Spec hard rule: milestones 3 & 4 require a photo. Renders pill when active w/o photo. */
  requiredPhoto?: boolean;
};

type Props = {
  milestones: Milestone[];
};

export function MilestoneTimeline({ milestones }: Props) {
  const { c, type, spacing } = useTheme();

  return (
    <View>
      {milestones.map((m, i) => {
        const isLast = i === milestones.length - 1;
        const dotColor = m.status === 'done' ? c.success : m.status === 'active' ? c.warning : c.border;
        const labelColor = m.status === 'pending' ? c.textMuted : c.text;

        return (
          <View key={m.number} style={styles.row}>
            {/* Left: dot + connector line */}
            <View style={styles.dotCol}>
              <View style={[styles.dot, { backgroundColor: dotColor, borderColor: dotColor }]}>
                {m.status === 'done' && <Text style={styles.tick}>✓</Text>}
              </View>
              {!isLast && <View style={[styles.line, { backgroundColor: m.status === 'done' ? c.success : c.border }]} />}
            </View>

            {/* Right: content */}
            <View style={[styles.content, { paddingBottom: isLast ? 0 : spacing.xl }]}>
              <Text style={[type.bodyStrong, { color: labelColor }]}>{m.label}</Text>
              {m.description ? (
                <Text style={[type.caption, { color: c.textMuted, marginTop: 2 }]}>{m.description}</Text>
              ) : null}
              {m.timestamp ? (
                <Text style={[type.caption, { color: c.textMuted, marginTop: 2 }]}>
                  {new Date(m.timestamp).toLocaleTimeString('en-ZM', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              ) : null}
              {m.photoUrl ? (
                <Image
                  source={{ uri: m.photoUrl }}
                  style={[styles.photo, { borderRadius: 8, marginTop: spacing.sm }]}
                  resizeMode="cover"
                />
              ) : m.requiredPhoto && m.status === 'active' ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: spacing.sm,
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: c.warning + '22',
                  }}
                >
                  <Text style={[type.caption, { color: c.warning, fontWeight: '600' }]}>Photo required</Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  dotCol: { width: 32, alignItems: 'center' },
  dot: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  tick: { color: '#fff', fontSize: 12, fontWeight: '700' },
  line: { width: 2, flex: 1, marginTop: 4 },
  content: { flex: 1, paddingLeft: 12 },
  photo: { width: '100%', height: 180 },
});
