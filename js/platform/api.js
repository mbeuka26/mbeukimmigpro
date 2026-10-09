import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../supabase-config.js';

const functionsBase = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1` : '';

export async function getAccessToken(supabase) {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function callFunction(supabase, name, body) {
  if (!functionsBase) throw new Error('Supabase non configuré');
  const token = await getAccessToken(supabase);
  if (!token) throw new Error('Connexion requise');
  const res = await fetch(`${functionsBase}/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}
