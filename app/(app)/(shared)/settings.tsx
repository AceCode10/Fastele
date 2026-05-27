import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Button, Card, TextField } from '@/components/ui';
import { getDefaults, saveDefaults } from '@/lib/defaults';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useMode } from '@/stores/modeStore';
import { useTheme } from '@/lib/theme';

const NOTIF_KEY = 'fastele.notif_enabled';

export default function Settings() {
  const { c, type, spacing } = useTheme();
  const profile = useAuth((s) => s.profile);
  const userId = useAuth((s) => s.userId);
  const signOut = useAuth((s) => s.signOut);

  const mode = useMode((s) => s.mode);
  const setMode = useMode((s) => s.setMode);

  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [airtelMsisdn, setAirtelMsisdn] = useState('');
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function switchMode() {
    if (switching) return;
    const target: 'requester' | 'runner' = mode === 'requester' ? 'runner' : 'requester';
    setSwitching(true);
    const result = await setMode(target);
    setSwitching(false);
    if (!result.ok) Alert.alert('Locked', result.reason);
  }

  useEffect(() => {
    getDefaults().then((d) => {
      setPickup(d.pickup);
      setDelivery(d.delivery);
      setAirtelMsisdn(d.airtelMsisdn);
    });
    AsyncStorage.getItem(NOTIF_KEY).then((v) => setNotifEnabled(v !== 'false'));
  }, []);

  async function saveAll() {
    setBusy(true);
    await saveDefaults({ pickup, delivery, airtelMsisdn });
    await AsyncStorage.setItem(NOTIF_KEY, notifEnabled ? 'true' : 'false');

    if (!notifEnabled && userId) {
      // Detach push token so server stops sending.
      await (supabase as any).from('users').update({ expo_push_token: null }).eq('id', userId);
    } else if (notifEnabled) {
      const perm = await Notifications.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Notifications', 'Permission denied. Enable in system settings.');
      }
    }
    setBusy(false);
    Alert.alert('Saved', 'Preferences updated.');
  }

  function changePhone() {
    Alert.alert(
      'Change phone number',
      'You will be signed out and need to verify the new number with OTP. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/welcome' as any); } },
      ]
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.lg }]}>Settings</Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.bodyStrong, { color: c.text }]}>Mode</Text>
        <Text style={[type.caption, { color: c.textMuted, marginTop: 4, marginBottom: spacing.md }]}>
          Currently: {mode === 'requester' ? 'I need help' : 'I can help'}. Locked while you have an active job.
        </Text>
        <Button
          label={mode === 'requester' ? 'Switch to runner' : 'Switch to requester'}
          variant="secondary"
          onPress={switchMode}
          loading={switching}
        />
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.sm }]}>Saved addresses</Text>
        <TextField label="Default pickup market" value={pickup} onChangeText={setPickup} placeholder="Soweto Market" />
        <TextField label="Default delivery address" value={delivery} onChangeText={setDelivery} placeholder="Garden Compound, plot 12" />
        <TextField
          label="Airtel Money number"
          value={airtelMsisdn}
          onChangeText={setAirtelMsisdn}
          placeholder="097 1234567"
          keyboardType="phone-pad"
        />
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={[type.bodyStrong, { color: c.text }]}>Push notifications</Text>
            <Text style={[type.caption, { color: c.textMuted, marginTop: 2 }]}>
              Milestone updates, dispute & report alerts.
            </Text>
          </View>
          <Switch value={notifEnabled} onValueChange={setNotifEnabled} />
        </View>
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[type.bodyStrong, { color: c.text }]}>Account</Text>
        <Text style={[type.caption, { color: c.textMuted, marginTop: 4, marginBottom: spacing.md }]}>
          {profile?.phone_number ?? '—'}
        </Text>
        <Button label="Change phone number" variant="secondary" onPress={changePhone} />
      </Card>

      <Button label="Save preferences" onPress={saveAll} loading={busy} />

      <Button label="Sign out" variant="danger" onPress={() => signOut()} style={{ marginTop: spacing.lg }} />
    </ScrollView>
  );
}
