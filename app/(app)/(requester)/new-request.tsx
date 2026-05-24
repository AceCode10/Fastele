import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen, TextField } from '@/components/ui';
import { LocationPicker, PickedLocation } from '@/components/LocationPicker';
import { supabase } from '@/lib/supabase';
import { getDefaults, saveDefaults } from '@/lib/defaults';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';
import { assertTapDepth } from '@/lib/threeTap';
import { DEV_SKIP_PAYMENTS } from '@/lib/featureFlags';

const PICKUP_PRESETS = ['Soweto Market', 'City Market'];

// TAP DEPTH: home '+' FAB = tap 1. This screen = tap 2 (fill). Post & Pay = tap 3.
// Total: 3 taps. Spec §9.2.

export default function NewRequest() {
  const { c, type, spacing, radius, tapTarget } = useTheme();
  const userId = useAuth((s) => s.userId);

  const [items, setItems] = useState('');
  const [pickup, setPickup] = useState<string>('Soweto Market');
  const [pickupOther, setPickupOther] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState<PickedLocation | null>(null);
  const [budget, setBudget] = useState('');
  const [fee, setFee] = useState('');
  const [airtelMsisdn, setAirtelMsisdn] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    assertTapDepth('requester.home->post', 3);
    getDefaults().then((d) => {
      if (d.pickup) {
        if (PICKUP_PRESETS.indexOf(d.pickup) >= 0) {
          setPickup(d.pickup);
        } else {
          setPickup('Other');
          setPickupOther(d.pickup);
        }
      }
      if (d.delivery && d.deliveryLat != null && d.deliveryLng != null) {
        setDeliveryLocation({
          address: d.delivery,
          latitude: d.deliveryLat,
          longitude: d.deliveryLng,
        });
      }
      setAirtelMsisdn(d.airtelMsisdn);
    });
  }, []);

  async function postAndPay() {
    if (!items.trim()) return Alert.alert('Add items', 'Describe what you need bought.');
    if (!deliveryLocation || !deliveryLocation.address.trim()) {
      return Alert.alert('Delivery address', 'Pick a delivery location on the map.');
    }
    const itemBudget = parseFloat(budget);
    const runnerFee = parseFloat(fee);
    if (isNaN(itemBudget) || itemBudget <= 0) return Alert.alert('Item budget', 'Enter amount in kwacha for items.');
    if (isNaN(runnerFee) || runnerFee <= 0) return Alert.alert('Runner fee', 'How much to offer the Runner?');
    if (!DEV_SKIP_PAYMENTS && !airtelMsisdn.trim()) {
      return Alert.alert('Airtel number', 'Enter Airtel number to pay from.');
    }

    const pickupFinal = pickup === 'Other' ? pickupOther.trim() : pickup;
    if (!pickupFinal) return Alert.alert('Pickup location', 'Choose or enter a pickup market.');

    setBusy(true);
    await saveDefaults({
      pickup: pickupFinal,
      delivery: deliveryLocation.address,
      deliveryLat: deliveryLocation.latitude,
      deliveryLng: deliveryLocation.longitude,
      airtelMsisdn,
    });

    // Create request row first (status open), then either trigger Airtel STK (real flow)
    // or call dev-fund-request (test mode) to flip escrow_funded.
    // dispute_reserve + expires_at are set by DB trigger from platform_config (audit #15, #16).
    const itemList = items.split('\n').map((l) => l.trim()).filter(Boolean);
    const { data: req, error: reqErr } = await (supabase as any)
      .from('requests')
      .insert({
        requester_id: userId,
        pickup_location: pickupFinal,
        delivery_address: deliveryLocation.address,
        delivery_lat: deliveryLocation.latitude,
        delivery_lng: deliveryLocation.longitude,
        item_list: itemList,
        item_budget: itemBudget,
        runner_fee: runnerFee,
        platform_fee: +(runnerFee * 0.1).toFixed(2),
        status: 'open',
      })
      .select('id')
      .single();

    if (reqErr) {
      setBusy(false);
      return Alert.alert('Could not create request', reqErr.message);
    }

    if (DEV_SKIP_PAYMENTS) {
      // Test mode: skip Airtel STK push. Auto-fund the request via
      // the dev-fund-request edge function so Runners can see it.
      const { error: fundErr } = await supabase.functions.invoke('dev-fund-request', {
        body: { requestId: req.id },
      });
      setBusy(false);
      if (fundErr) {
        await (supabase as any).from('requests').delete().eq('id', req.id);
        return Alert.alert(
          'Could not post request',
          'dev-fund-request failed. Make sure the edge function is deployed and FASTELE_ALLOW_DEV_FUND=true.'
        );
      }
      Alert.alert(
        'Request posted!',
        'Runners can now see it. (Test mode — payment skipped.)',
        [{ text: 'OK', onPress: () => router.replace('/(app)/(requester)') }]
      );
      return;
    }

    // Production path: trigger Airtel STK push via edge function.
    const { error: payErr } = await supabase.functions.invoke('airtel-collect', {
      body: {
        requestId: req.id,
        msisdn: airtelMsisdn.replace(/\D/g, ''),
        amount: itemBudget + runnerFee,
      },
    });

    setBusy(false);

    if (payErr) {
      // Roll back request if payment initiation fails.
      await (supabase as any).from('requests').delete().eq('id', req.id);
      return Alert.alert(
        'Payment failed',
        'Could not initiate Airtel payment. Check your number and try again.'
      );
    }

    Alert.alert(
      'Check your phone',
      'Approve the Airtel Money prompt to fund your request.',
      [{ text: 'OK', onPress: () => router.replace('/(app)/(requester)') }]
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={[type.h1, { color: c.text, marginBottom: spacing.lg }]}>New request</Text>

        <Text style={[type.bodyStrong, { color: c.text, marginBottom: 6 }]}>Items to buy</Text>
        <TextInput
          placeholder={"2kg Rice\n500ml Cooking oil\nZambia Sugar 1kg"}
          placeholderTextColor={c.textMuted}
          multiline
          numberOfLines={5}
          value={items}
          onChangeText={setItems}
          style={{
            backgroundColor: c.surfaceAlt,
            borderRadius: radius.md,
            padding: 14,
            minHeight: 120,
            color: c.text,
            fontSize: 17,
            textAlignVertical: 'top',
            marginBottom: spacing.lg,
          }}
        />

        <Text style={[type.bodyStrong, { color: c.text, marginBottom: 6 }]}>Pickup market</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
          {[...PICKUP_PRESETS, 'Other'].map((opt) => {
            const active = pickup === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => setPickup(opt)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 10,
                  borderRadius: radius.pill,
                  backgroundColor: active ? c.primary : c.surfaceAlt,
                  borderWidth: 1,
                  borderColor: active ? c.primary : c.border,
                  minHeight: tapTarget.min - 8,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: active ? c.primaryFg : c.text, fontWeight: '600' }}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
        {pickup === 'Other' && (
          <TextField
            label="Specify pickup"
            placeholder="e.g. COMESA Market"
            value={pickupOther}
            onChangeText={setPickupOther}
          />
        )}

        <Text style={[type.bodyStrong, { color: c.text, marginBottom: 6 }]}>Deliver to</Text>
        <LocationPicker
          initial={deliveryLocation}
          onChange={setDeliveryLocation}
          hint="Drop the pin or search for the delivery address."
        />

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Item budget (K)"
              placeholder="150"
              keyboardType="numeric"
              value={budget}
              onChangeText={setBudget}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Runner fee (K)"
              placeholder="30"
              keyboardType="numeric"
              value={fee}
              onChangeText={setFee}
            />
          </View>
        </View>

        {!DEV_SKIP_PAYMENTS && (
          <TextField
            label="Pay from Airtel number"
            placeholder="097 1234567"
            keyboardType="phone-pad"
            value={airtelMsisdn}
            onChangeText={setAirtelMsisdn}
            hint="Funds held in escrow until delivery."
          />
        )}
        {DEV_SKIP_PAYMENTS && (
          <Text style={[type.caption, { color: c.textMuted, fontStyle: 'italic', marginTop: spacing.sm }]}>
            Test mode — no payment required. Request will be auto-funded so Runners can see it.
          </Text>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: c.bg }}>
        <Button label={DEV_SKIP_PAYMENTS ? 'Post Request' : 'Post & Pay'} onPress={postAndPay} loading={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}
