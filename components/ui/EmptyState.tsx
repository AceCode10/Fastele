import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

export function EmptyState({ title, body }: { title: string; body?: string }) {
  const { c, type, spacing } = useTheme();
  return (
    <View style={[styles.wrap, { padding: spacing.xl }]}>
      <Text style={[type.h2, { color: c.text, textAlign: 'center' }]}>{title}</Text>
      {body ? (
        <Text style={[type.body, { color: c.textMuted, textAlign: 'center', marginTop: 8 }]}>{body}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', justifyContent: 'center', flex: 1 } });
