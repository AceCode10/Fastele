import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

export type PickedLocation = {
  address: string;
  latitude: number;
  longitude: number;
};

type Props = {
  label?: string;
  hint?: string;
  initial?: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
};

export function LocationPicker({ label, hint }: Props) {
  const { c, type, spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? (
        <Text style={[type.bodyStrong, { color: c.text, marginBottom: 6 }]}>{label}</Text>
      ) : null}
      <Text style={[type.body, { color: c.textMuted }]}>
        Location picker not available on web. Use the mobile app to create requests.
      </Text>
      {hint ? (
        <Text style={[type.caption, { color: c.textMuted, marginTop: 6 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}
