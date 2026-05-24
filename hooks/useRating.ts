import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';

export function useSubmitRating() {
  const qc = useQueryClient();
  const userId = useAuth((s) => s.userId);

  return useMutation({
    mutationFn: async ({ requestId, ratedId, stars, comment }: {
      requestId: string;
      ratedId: string;
      stars: number;
      comment?: string;
    }) => {
      const { error } = await (supabase as any).from('ratings').insert({
        request_id: requestId,
        rater_id: userId,
        rated_id: ratedId,
        stars,
        comment: comment ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['request', vars.requestId] });
    },
  });
}
