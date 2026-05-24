import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuth } from './authStore';

export type Mode = 'requester' | 'runner';

const KEY = 'fastele.mode';

type ModeState = {
  mode: Mode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (m: Mode) => Promise<{ ok: true } | { ok: false; reason: string }>;
};

async function hasActiveTransaction(userId: string): Promise<boolean> {
  const active = ['matched', 'items_purchased', 'in_transit', 'disputed'];
  const [{ data: asReq }, { data: asRun }] = await Promise.all([
    (supabase as any).from('requests').select('id').eq('requester_id', userId).in('status', active).limit(1),
    (supabase as any).from('requests').select('id').eq('runner_id', userId).in('status', active).limit(1),
  ]);
  return (asReq?.length ?? 0) > 0 || (asRun?.length ?? 0) > 0;
}

export const useMode = create<ModeState>((set, get) => ({
  mode: 'requester',
  hydrated: false,

  hydrate: async () => {
    const stored = (await AsyncStorage.getItem(KEY)) as Mode | null;
    const profile = useAuth.getState().profile;
    set({ mode: stored ?? profile?.default_mode ?? 'requester', hydrated: true });
  },

  setMode: async (m) => {
    if (m === get().mode) return { ok: true };
    const userId = useAuth.getState().userId;
    if (userId && (await hasActiveTransaction(userId))) {
      return {
        ok: false,
        reason: "You have an active request. Switching is available once it's complete.",
      };
    }
    await AsyncStorage.setItem(KEY, m);
    set({ mode: m });
    if (userId) {
      await (supabase as any).from('users').update({ default_mode: m }).eq('id', userId);
    }
    return { ok: true };
  },
}));
