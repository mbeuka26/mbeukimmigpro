let _url = '';
let _anon = '';

export function configureSupabase(url, anonKey) {
  _url = (url || '').replace(/\/$/, '');
  _anon = anonKey || '';
}

const functionsBase = () => (_url ? `${_url}/functions/v1` : '');

export async function getAccessToken(supabase) {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function callFunction(supabase, name, body) {
  const base = functionsBase();
  if (!base) throw new Error('Supabase non configuré');
  const token = await getAccessToken(supabase);
  if (!token) throw new Error('Connexion requise');
  const res = await fetch(`${base}/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: _anon,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}
