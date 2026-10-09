import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function userClient(authHeader: string | null) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  return createClient(url, anon, {
    global: { headers: { Authorization: authHeader ?? '' } },
  });
}

export async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('UNAUTHORIZED');
  const client = userClient(authHeader);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('UNAUTHORIZED');
  return { user: data.user, client };
}

export function isAdmin(user: { app_metadata?: Record<string, unknown> }) {
  return user.app_metadata?.role === 'admin';
}
