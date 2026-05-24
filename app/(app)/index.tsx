import { Redirect } from 'expo-router';
import { useMode } from '@/stores/modeStore';

export default function AppIndex() {
  const mode = useMode((s) => s.mode);
  return mode === 'runner' ? <Redirect href="/(app)/(runner)/feed" /> : <Redirect href="/(app)/(requester)" />;
}
