import { Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './supabase';

// Fixed dev test accounts — seeded via supabase/dev_seed.sql.
// REMOVE BEFORE PUBLIC RELEASE — see featureFlags.DEV_SKIP_OTP.
export const DEV_REQUESTER_EMAIL = 'dev-test@fastele.local';
export const DEV_RUNNER_EMAIL = 'dev-runner@fastele.local';
const DEV_PASSWORD = 'DevTest1234!';

export async function devSignIn(email: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  });
  if (error) {
    Alert.alert('Dev sign-in failed', error.message);
    return false;
  }
  router.replace('/');
  return true;
}
