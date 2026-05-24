import { QueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';

export type AdminRole = 'super_admin' | 'support_agent' | null;

const adminRoleKey = (userId: string | null) => ['admin-role', userId];

export function useIsAdmin() {
  const userId = useAuth((s) => s.userId);
  const q = useQuery({
    queryKey: adminRoleKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminRole> => {
      const { data } = await (supabase as any)
        .from('admins')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      return (data?.role as AdminRole) ?? null;
    },
  });
  return {
    isAdmin: !!q.data,
    isSuperAdmin: q.data === 'super_admin',
    role: q.data ?? null,
    isLoading: q.isLoading,
  };
}

/** Call after a promote/demote so the local admin gate refreshes immediately. */
export function invalidateAdminRole(qc: QueryClient, userId: string | null) {
  qc.invalidateQueries({ queryKey: adminRoleKey(userId) });
}
