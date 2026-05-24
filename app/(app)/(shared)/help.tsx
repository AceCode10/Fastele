import React, { useState } from 'react';
import { Alert, Linking, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How does escrow work?',
    a: 'When you post a request, Airtel Money holds your payment. The Runner only gets paid after you confirm delivery (or after 48 hours automatically).',
  },
  {
    q: 'What if the Runner buys the wrong items?',
    a: 'Raise a dispute from the delivered request. An admin reviews photos within 24h and issues a full or partial refund.',
  },
  {
    q: 'How do I become a Runner?',
    a: 'Switch to Runner mode, then tap "Verify". Upload your NRC and a selfie. Admins review within 24h.',
  },
  {
    q: 'How is the Runner fee split?',
    a: 'You set the fee. Fastele takes 10% as platform fee. Runner gets the remaining 90% via Airtel Money disbursement.',
  },
  {
    q: 'Why can I not see new jobs in the feed?',
    a: 'Lower-rated and unverified Runners see jobs after a short delay so higher-rated Runners get first pick.',
  },
];

export default function Help() {
  const { c, type, spacing } = useTheme();
  const userId = useAuth((s) => s.userId);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function contactAdmin() {
    if (!message.trim()) return Alert.alert('Empty message', 'Describe your issue.');
    if (!userId) return;
    setBusy(true);
    const { error } = await (supabase as any).from('support_messages').insert({
      user_id: userId,
      message: message.trim(),
    });
    setBusy(false);
    if (error) {
      // Fallback: open SMS to admin number.
      Linking.openURL(`sms:+260971234567?body=${encodeURIComponent(message)}`);
      return;
    }
    setMessage('');
    Alert.alert('Sent', 'Admin replies within 24h via SMS.');
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <Text style={[type.h1, { color: c.text, marginBottom: spacing.lg }]}>Help & Support</Text>

      <Text style={[type.bodyStrong, { color: c.text, marginBottom: spacing.sm }]}>Frequently asked</Text>
      {FAQS.map((f, i) => (
        <Card key={i} onPress={() => setExpanded(expanded === i ? null : i)} style={{ marginBottom: spacing.sm }}>
          <Text style={[type.bodyStrong, { color: c.text }]}>{f.q}</Text>
          {expanded === i && (
            <Text style={[type.body, { color: c.textMuted, marginTop: spacing.sm }]}>{f.a}</Text>
          )}
        </Card>
      ))}

      <Text style={[type.bodyStrong, { color: c.text, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        Contact admin
      </Text>
      <Card style={{ marginBottom: spacing.lg }}>
        <TextInput
          placeholder="Describe your issue..."
          placeholderTextColor={c.textMuted}
          multiline
          numberOfLines={5}
          value={message}
          onChangeText={setMessage}
          style={{ minHeight: 100, color: c.text, fontSize: 17, textAlignVertical: 'top' }}
        />
      </Card>
      <Button label="Send to admin" onPress={contactAdmin} loading={busy} disabled={!message.trim()} />

      <Button
        label="Report a user (about a request)"
        variant="secondary"
        onPress={() => Alert.alert('From the request', 'Open the request and tap "Report" — that links the report to the right user.')}
        style={{ marginTop: spacing.lg }}
      />

      <Text style={[type.caption, { color: c.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
        Emergency: SMS 0971-234-567 or call.
      </Text>
    </ScrollView>
  );
}
