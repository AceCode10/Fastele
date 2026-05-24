import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

type Props = {
  label: string;
  onRate: (stars: number) => void;
  submitted?: boolean;
};

export function RatingCard({ label, onRate, submitted }: Props) {
  const { c, type, radius, spacing } = useTheme();
  const [selected, setSelected] = useState(0);

  function tap(stars: number) {
    if (submitted) return;
    setSelected(stars);
    onRate(stars);
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, borderRadius: radius.lg, padding: spacing.lg }]}>
      <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.md }]}>{label}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Pressable key={s} onPress={() => tap(s)} style={styles.star} accessibilityLabel={`${s} star`}>
            <Text style={{ fontSize: 36, color: s <= (selected || 0) ? c.warning : c.border }}>★</Text>
          </Pressable>
        ))}
      </View>
      {submitted && <Text style={[type.caption, { color: c.textMuted, marginTop: spacing.sm }]}>Rating saved.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  stars: { flexDirection: 'row', justifyContent: 'center' },
  star: { paddingHorizontal: 6, paddingVertical: 4 },
});
