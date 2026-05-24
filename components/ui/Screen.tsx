import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  // Parent wraps top edge already (e.g. (app)/_layout). Keep only bottom by default to avoid double padding.
  edges?: Edge[];
};

export function Screen({ children, scroll = false, padded = true, style, edges = ['bottom'] }: Props) {
  const { c, spacing } = useTheme();
  const Body = (
    <View style={[{ flex: 1, padding: padded ? spacing.lg : 0 }, style]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: c.bg }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {Body}
        </ScrollView>
      ) : (
        Body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1 } });
