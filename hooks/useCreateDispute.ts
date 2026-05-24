import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type CreateDisputeArgs = {
  requestId: string;
  reason: 'wrong_items' | 'missing_items' | 'not_delivered' | 'damaged' | 'other';
  description?: string | null;
  evidenceUrl?: string | null;
};

export function useCreateDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateDisputeArgs) => {
      const { data, error } = await (supabase as any).functions.invoke('create-dispute', {
        body: args,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { ok: true; disputeId: string };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['request', vars.requestId] });
      qc.invalidateQueries({ queryKey: ['admin', 'disputes'] });
    },
  });
}
