import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

type Props = {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({ title = 'Something went wrong', body, onRetry, retryLabel = 'Try again' }: Props) {
  const { c, type, spacing, radius } = useTheme();
  return (
    <View style={[styles.wrap, { padding: spacing.xl }]}>
      <Text style={[type.h2, { color: c.text, textAlign: 'center' }]}>{title}</Text>
      {body ? (
        <Text style={[type.body, { color: c.textMuted, textAlign: 'center', marginTop: 8 }]}>{body}</Text>
      ) : null}
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [{
            marginTop: spacing.lg,
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: radius.md,
            backgroundColor: pressed ? c.primary + 'dd' : c.primary,
          }]}
        >
          <Text style={[type.bodyStrong, { color: '#fff' }]}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', justifyContent: 'center', flex: 1 } });
