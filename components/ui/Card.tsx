import React from 'react';
import { Pressable, View, ViewStyle } from 'react-native';
import { useTheme } from '@/lib/theme';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
};

export function Card({ children, onPress, style, padded = true }: Props) {
  const { c, radius, spacing } = useTheme();
  const base: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: padded ? spacing.lg : 0,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
