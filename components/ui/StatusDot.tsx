import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

type Status = 'success' | 'progress' | 'problem' | 'idle';

const accessibleLabel: Record<Status, string> = {
  success: 'Complete',
  progress: 'In progress',
  problem: 'Problem',
  idle: 'Idle',
};

export function StatusDot({ status, label }: { status: Status; label?: string }) {
  const { c, type } = useTheme();
  const color =
    status === 'success' ? c.success : status === 'progress' ? c.warning : status === 'problem' ? c.danger : c.textMuted;
  const text = label ?? accessibleLabel[status];
  return (
    <View style={styles.row} accessibilityLabel={`${text} status`}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[type.caption, { color: c.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
});
