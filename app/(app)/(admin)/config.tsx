import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Screen, TextField } from '@/components/ui';
import { usePlatformConfig } from '@/hooks/useAdmin';
import { useTheme } from '@/lib/theme';

export default function AdminConfig() {
  const { c, type, spacing } = useTheme();
  const { data: cfg, update } = usePlatformConfig();
  const [commission, setCommission] = useState('');
  const [autoRelease, setAutoRelease] = useState('');
  const [expireMin, setExpireMin] = useState('');

  useEffect(() => {
    if (!cfg) return;
    setCommission(String(cfg.commission_pct ?? 10));
    setAutoRelease(String(cfg.auto_release_hours ?? 48));
    setExpireMin(String(cfg.expire_minutes ?? 60));
  }, [cfg]);

  async function save() {
    const c_pct = parseFloat(commission);
    const ar = parseFloat(autoRelease);
    const em = parseFloat(expireMin);
    if (isNaN(c_pct) || c_pct < 0 || c_pct > 100) return Alert.alert('Commission must be 0–100');
    if (isNaN(ar) || ar < 1) return Alert.alert('Auto-release must be >= 1 hour');
    if (isNaN(em) || em < 10) return Alert.alert('Expire must be >= 10 min');

    await Promise.all([
      update.mutateAsync({ key: 'commission_pct', value: c_pct }),
      update.mutateAsync({ key: 'auto_release_hours', value: ar }),
      update.mutateAsync({ key: 'expire_minutes', value: em }),
    ]);
    Alert.alert('Saved');
  }

  return (
    <Screen scroll>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.xl }]}>Platform config</Text>

      <TextField
        label="Commission % (default 10)"
        keyboardType="numeric"
        value={commission}
        onChangeText={setCommission}
        hint="Platform takes this % of runner_fee on every delivery."
      />
      <TextField
        label="Auto-release hours (default 48)"
        keyboardType="numeric"
        value={autoRelease}
        onChangeText={setAutoRelease}
        hint="Payment auto-releases to Runner if Requester doesn't confirm."
      />
      <TextField
        label="Request expiry minutes (default 60)"
        keyboardType="numeric"
        value={expireMin}
        onChangeText={setExpireMin}
        hint="Open requests auto-expire after this many minutes with no Runner."
      />

      <Button label="Save changes" onPress={save} loading={update.isPending} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}
