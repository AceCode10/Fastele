import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Best-effort push token registration. Without google-services.json on Android,
// `getExpoPushTokenAsync()` throws "Default FirebaseApp is not initialized".
// We swallow the error so app boot is never blocked by missing FCM config.
export async function registerPushToken(userId: string) {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const { data } = await Notifications.getExpoPushTokenAsync();
    if (!data) return;

    await (supabase as any)
      .from('users')
      .update({ expo_push_token: data })
      .eq('id', userId);
  } catch (e) {
    // Most common cause: Firebase / google-services.json not configured.
    // Notifications are non-critical for the test flow — keep going.
    console.warn('[push] registerPushToken skipped:', (e as Error)?.message ?? e);
  }
}
