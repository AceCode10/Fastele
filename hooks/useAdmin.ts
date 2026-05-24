import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';

// Pending NRC verifications. Generates short-lived signed URLs for the two photos.
export function usePendingVerifications() {
  return useQuery({
    queryKey: ['admin', 'verifications'],
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('users')
        .select('id, full_name, phone_number, nrc_photo_url, selfie_url, created_at')
        .eq('is_runner_verified', false)
        .not('nrc_photo_url', 'is', null)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const enriched = await Promise.all((data ?? []).map(async (u: any) => {
        const sign = async (storedPath: string | null) => {
          if (!storedPath) return null;
          // Path format: "<bucket>/<userId>/<filename>"
          const slash = storedPath.indexOf('/');
          if (slash < 0) return null;
          const bucket = storedPath.slice(0, slash);
          const path = storedPath.slice(slash + 1);
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
          return signed?.signedUrl ?? null;
        };
        return {
          ...u,
          nrc_signed_url: await sign(u.nrc_photo_url),
          selfie_signed_url: await sign(u.selfie_url),
        };
      }));

      return enriched;
    },
  });
}

// Approve or reject verification.
export function useVerificationAction() {
  const qc = useQueryClient();
  const adminId = useAuth((s) => s.userId);

  return useMutation({
    mutationFn: async ({ userId, approve }: { userId: string; approve: boolean }) => {
      const { error } = await (supabase as any)
        .from('users')
        .update({ is_runner_verified: approve })
        .eq('id', userId);
      if (error) throw error;
      await (supabase as any).from('admin_actions').insert({
        admin_id: adminId,
        action: approve ? 'verification_approved' : 'verification_rejected',
        target_table: 'users',
        target_id: userId,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'verifications'] }),
  });
}

// Helper to sign a stored "bucket/path" string.
async function signStored(stored: string | null): Promise<string | null> {
  if (!stored) return null;
  const slash = stored.indexOf('/');
  if (slash < 0) return stored; // already a URL
  const bucket = stored.slice(0, slash);
  const path = stored.slice(slash + 1);
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

// Open disputes.
export function useAdminDisputes() {
  return useQuery({
    queryKey: ['admin', 'disputes'],
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('disputes')
        .select(`
          id, reason, description, evidence_url, runner_response, status, ruling, created_at,
          request:requests(id, pickup_location, delivery_address, item_list, runner_fee,
            photo_items_url, photo_handoff_url,
            requester:users!requester_id(id, full_name, phone_number),
            runner:users!runner_id(id, full_name, phone_number)
          )
        `)
        .neq('status', 'resolved')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return await Promise.all((data ?? []).map(async (d: any) => ({
        ...d,
        evidence_signed_url: await signStored(d.evidence_url),
      })));
    },
  });
}

// Open reports.
export function useAdminReports() {
  return useQuery({
    queryKey: ['admin', 'reports'],
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('reports')
        .select(`
          id, reason, description, evidence_url, outcome, created_at,
          reporter:users!reporter_id(id, full_name, phone_number),
          reported:users!reported_id(id, full_name, phone_number)
        `)
        .eq('outcome', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return await Promise.all((data ?? []).map(async (r: any) => ({
        ...r,
        evidence_signed_url: await signStored(r.evidence_url),
      })));
    },
  });
}

// Apply report outcome.
export function useReportAction() {
  const qc = useQueryClient();
  const adminId = useAuth((s) => s.userId);

  return useMutation({
    mutationFn: async ({ reportId, reportedId, outcome }: {
      reportId: string; reportedId: string; outcome: 'warning' | 'suspension' | 'ban' | 'dismissed';
    }) => {
      await (supabase as any).from('reports').update({ outcome, admin_id: adminId, resolved_at: new Date().toISOString() }).eq('id', reportId);
      if (outcome === 'suspension') await (supabase as any).from('users').update({ is_suspended: true }).eq('id', reportedId);
      if (outcome === 'ban') await (supabase as any).from('users').update({ is_banned: true, is_suspended: true }).eq('id', reportedId);
      await (supabase as any).from('admin_actions').insert({ admin_id: adminId, action: `report_${outcome}`, target_table: 'reports', target_id: reportId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });
}

// Platform stats.
export function usePlatformStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    staleTime: 60_000,
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [{ count: totalToday }, { count: activeNow }, { count: disputes }, { count: newRunners }] = await Promise.all([
        (supabase as any).from('requests').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        (supabase as any).from('requests').select('*', { count: 'exact', head: true }).in('status', ['matched', 'items_purchased', 'in_transit']),
        (supabase as any).from('disputes').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
        (supabase as any).from('users').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()).eq('is_runner_verified', false).not('nrc_photo_url', 'is', null),
      ]);
      return { totalToday, activeNow, disputes, newRunners };
    },
  });
}

// Platform config read/update.
export function usePlatformConfig() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'config'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any).from('platform_config').select('key, value');
      return Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
    },
  });
  const update = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      await (supabase as any).from('platform_config').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'config'] }),
  });
  return { ...query, update };
}
