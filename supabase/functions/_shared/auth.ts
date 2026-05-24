import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type AuthResult =
  | { ok: true; userId: string; userClient: SupabaseClient; serviceClient: SupabaseClient }
  | { ok: false; status: number; message: string };

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function authenticate(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return { ok: false, status: 401, message: 'Missing Authorization' };

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(url, service);

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return { ok: false, status: 401, message: 'Invalid token' };

  return { ok: true, userId: data.user.id, userClient, serviceClient };
}

export async function requireAdmin(serviceClient: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await serviceClient.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}
