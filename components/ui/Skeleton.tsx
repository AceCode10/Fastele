import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/lib/theme';

type Props = { width?: number | string; height?: number; radius?: number; style?: ViewStyle };

export function Skeleton({ width = '100%', height = 20, radius = 8, style }: Props) {
  const { c } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius: radius, backgroundColor: c.border, opacity }, style]}
    />
  );
}

export function SkeletonCard() {
  const { c, spacing, radius } = useTheme();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, marginBottom: spacing.md }]}>
      <Skeleton width="60%" height={18} />
      <View style={{ height: 8 }} />
      <Skeleton width="40%" height={14} />
      <View style={{ height: 12 }} />
      <Skeleton width="100%" height={14} />
      <View style={{ height: 4 }} />
      <Skeleton width="80%" height={14} />
    </View>
  );
}
