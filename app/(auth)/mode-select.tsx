import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui';
import { useMode } from '@/stores/modeStore';
import { useTheme } from '@/lib/theme';

export default function ModeSelect() {
  const setMode = useMode((s) => s.setMode);
  const { c, type, radius, spacing } = useTheme();

  async function pick(m: 'requester' | 'runner') {
    await setMode(m);
    router.replace('/(app)');
  }

  function Card({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            borderWidth: 1,
            borderRadius: radius.lg,
            padding: spacing.xl,
            marginBottom: spacing.lg,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Text style={[type.h2, { color: c.text }]}>{title}</Text>
        <Text style={[type.body, { color: c.textMuted, marginTop: 8 }]}>{body}</Text>
      </Pressable>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: spacing.xxl }}>
        <Text style={[type.h1, { color: c.text }]}>What do you want to do?</Text>
        <Text style={[type.body, { color: c.textMuted, marginTop: 6, marginBottom: spacing.xl }]}>
          You can change this any time.
        </Text>
        <Card
          title="I need something done"
          body="Post an errand. A trusted Runner buys and sends it via bus or taxi."
          onPress={() => pick('requester')}
        />
        <Card
          title="I can do errands"
          body="Browse jobs near you. Earn cash per delivery."
          onPress={() => pick('runner')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({});
