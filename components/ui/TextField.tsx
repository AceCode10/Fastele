import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '@/lib/theme';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
};

export function TextField({ label, hint, style, ...rest }: Props) {
  const { c, radius, type, spacing, tapTarget } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? <Text style={[type.bodyStrong, { color: c.text, marginBottom: 6 }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={c.textMuted}
        style={[
          {
            backgroundColor: c.surfaceAlt,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            minHeight: tapTarget.min,
            color: c.text,
            fontSize: 17,
          },
          style,
        ]}
        {...rest}
      />
      {hint ? <Text style={[type.caption, { color: c.textMuted, marginTop: 6 }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({});
