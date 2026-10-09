import { bootMbeukHubGate } from '../../src/mbeuk-gate/boot.js';
import { renderImmigrationScene } from './immigration-scene.js';
import { ROUTES } from './hub-routes.js';

document.getElementById('immigration-scene').innerHTML = renderImmigrationScene();

function feedback(payload) {
  const el = document.getElementById('authMsg');
  if (!el) return;
  el.textContent = payload.text || '';
  el.className = 'auth-portal__feedback'
    + (payload.type === 'error' ? ' auth-portal__feedback--error' : '')
    + (payload.type === 'success' ? ' auth-portal__feedback--success' : '');
}

document.getElementById('btn-back-access')?.addEventListener('click', () => {
  globalThis.location.href = ROUTES.chooseAccess;
});

document.getElementById('btn-skip-promo')?.addEventListener('click', async () => {
  const input = document.getElementById('promo-code');
  if (input) input.value = '';
  sessionStorage.removeItem('mbeuk_hub_manual_promo');
  document.querySelector('[data-mbeuk-checkout]')?.click();
});

const configMod = await import('../supabase-config.js').catch(() => null);
if (configMod?.SUPABASE_URL && configMod?.SUPABASE_ANON_KEY) {
  await bootMbeukHubGate({
    supabaseUrl: configMod.SUPABASE_URL,
    anonKey: configMod.SUPABASE_ANON_KEY,
    productName: 'MbeukImmig Pro',
    sector: 'education',
    authMode: 'existing',
    pageRouting: true,
    protectedRoot: '#promo-root',
    skipLiveHub: true,
    feedback,
  });
}
