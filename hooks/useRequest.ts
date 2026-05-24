import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const FIELDS = `
  id, status, pickup_location, delivery_address, delivery_lat, delivery_lng,
  item_list, item_budget, runner_fee, platform_fee,
  photo_items_url, photo_handoff_url, driver_phone, taxi_plate,
  milestone_timestamps, posted_at, accepted_at, delivered_at, expires_at,
  requester_id, runner_id,
  runner:users!runner_id(id, full_name, runner_rating_avg, runner_rating_count, expo_push_token),
  requester:users!requester_id(id, full_name, requester_rating_avg, requester_rating_count)
`;

export function useRequest(id: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['request', id],
    enabled: !!id,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('requests')
        .select(FIELDS)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`request:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ['request', id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, qc]);

  return query;
}

export function useActiveRequesterRequest(requesterId: string | null) {
  const qc = useQueryClient();
  const activeStatuses = ['open', 'matched', 'items_purchased', 'in_transit', 'disputed'];

  const query = useQuery({
    queryKey: ['active-request', requesterId],
    enabled: !!requesterId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('requests')
        .select(FIELDS)
        .eq('requester_id', requesterId!)
        .in('status', activeStatuses)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!requesterId) return;
    const channel = supabase
      .channel(`active-requester:${requesterId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests', filter: `requester_id=eq.${requesterId}` }, () => {
        qc.invalidateQueries({ queryKey: ['active-request', requesterId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requesterId, qc]);

  return query;
}
