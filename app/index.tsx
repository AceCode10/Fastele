import { Redirect } from 'expo-router';
import { useAuth } from '@/stores/authStore';

export default function Index() {
  const userId = useAuth((s) => s.userId);
  const profile = useAuth((s) => s.profile);
  if (!userId) return <Redirect href="/(auth)/welcome" />;
  if (!profile) return <Redirect href="/(auth)/name" />;
  return <Redirect href="/(app)" />;
}
