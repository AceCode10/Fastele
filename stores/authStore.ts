import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  phone_number: string;
  full_name: string;
  default_mode: 'requester' | 'runner';
  is_runner_verified: boolean;
  requester_rating_avg: number | null;
  runner_rating_avg: number | null;
  runner_rating_count: number;
};

type AuthState = {
  ready: boolean;
  userId: string | null;
  profile: Profile | null;
  setSession: (userId: string | null) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  ready: false,
  userId: null,
  profile: null,

  setSession: async (userId) => {
    set({ userId });
    if (userId) await get().refreshProfile();
    set({ ready: true });
  },

  refreshProfile: async () => {
    const { userId } = get();
    if (!userId) return set({ profile: null });
    const { data } = await (supabase as any)
      .from('users')
      .select(
        'id, phone_number, full_name, default_mode, is_runner_verified, requester_rating_avg, runner_rating_avg, runner_rating_count'
      )
      .eq('id', userId)
      .maybeSingle();
    set({ profile: data ?? null });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ userId: null, profile: null });
  },
}));

export async function bootstrapAuth() {
  const { data } = await supabase.auth.getSession();
  await useAuth.getState().setSession(data.session?.user.id ?? null);
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.getState().setSession(session?.user.id ?? null);
  });
}
