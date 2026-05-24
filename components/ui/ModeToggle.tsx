import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { useMode } from '@/stores/modeStore';

export function ModeToggle() {
  const { c, radius, type, tapTarget } = useTheme();
  const mode = useMode((s) => s.mode);
  const setMode = useMode((s) => s.setMode);
  const [busy, setBusy] = useState(false);

  async function pick(m: 'requester' | 'runner') {
    if (m === mode || busy) return;
    setBusy(true);
    const result = await setMode(m);
    setBusy(false);
    if (!result.ok) Alert.alert('Locked', result.reason);
  }

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: c.surfaceAlt, borderRadius: radius.pill, padding: 4, minHeight: tapTarget.min },
      ]}
    >
      <Tab label="I need help" active={mode === 'requester'} onPress={() => pick('requester')} />
      <Tab label="I can help" active={mode === 'runner'} onPress={() => pick('runner')} />
    </View>
  );

  function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.tab,
          {
            backgroundColor: active ? c.primary : 'transparent',
            borderRadius: radius.pill,
          },
        ]}
      >
        <Text style={[type.bodyStrong, { color: active ? c.primaryFg : c.textMuted }]}>{label}</Text>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
});
