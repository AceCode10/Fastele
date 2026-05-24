import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const FEED_FIELDS = `
  id, status, pickup_location, delivery_address, item_list,
  item_budget, runner_fee, posted_at, expires_at,
  requester:users!requester_id(id, full_name, requester_rating_avg, requester_rating_count)
`;

export function useFeed() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['feed'],
    staleTime: 5_000,
    queryFn: async () => {
      // RLS is_visible_to_runner handles time-window filtering server-side.
      const { data, error } = await (supabase as any)
        .from('requests')
        .select(FEED_FIELDS)
        .eq('status', 'open')
        .order('posted_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: new open requests or status changes.
  useEffect(() => {
    const channel = supabase
      .channel('feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: "status=eq.open" }, () => {
        qc.invalidateQueries({ queryKey: ['feed'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return query;
}

export function useActiveRunnerJob(runnerId: string | null) {
  const qc = useQueryClient();
  const activeStatuses = ['matched', 'items_purchased', 'in_transit'];

  const query = useQuery({
    queryKey: ['active-job', runnerId],
    enabled: !!runnerId,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('requests')
        .select(`
          id, status, pickup_location, delivery_address, item_list,
          item_budget, runner_fee, milestone_timestamps,
          photo_items_url, photo_handoff_url, driver_phone, taxi_plate,
          requester:users!requester_id(id, full_name, requester_rating_avg)
        `)
        .eq('runner_id', runnerId!)
        .in('status', activeStatuses)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!runnerId) return;
    const channel = supabase
      .channel(`active-job:${runnerId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests', filter: `runner_id=eq.${runnerId}` }, () => {
        qc.invalidateQueries({ queryKey: ['active-job', runnerId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [runnerId, qc]);

  return query;
}
