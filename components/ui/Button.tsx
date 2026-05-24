import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  fullWidth = true,
  icon,
  style,
}: Props) {
  const { c, radius, type, tapTarget } = useTheme();

  const bg =
    variant === 'primary'
      ? c.primary
      : variant === 'danger'
      ? c.accent
      : variant === 'secondary'
      ? c.surfaceAlt
      : 'transparent';

  const fg =
    variant === 'primary'
      ? c.primaryFg
      : variant === 'danger'
      ? c.accentFg
      : variant === 'secondary'
      ? c.text
      : c.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderRadius: radius.cta,
          minHeight: tapTarget.min + 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          paddingHorizontal: fullWidth ? 0 : 20,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
          <Text style={[type.cta, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
