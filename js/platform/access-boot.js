import { bootMbeukHubGate } from '../../src/mbeuk-gate/boot.js';
import { GateStatus } from '../../src/mbeuk-gate/mbeuk-hub-gate.js';
import { ROUTES } from './hub-routes.js';
import { renderImmigrationScene } from './immigration-scene.js';

document.getElementById('immigration-scene').innerHTML = renderImmigrationScene();

function feedback(payload) {
  const el = document.getElementById('authMsg');
  if (!el) return;
  el.textContent = payload.text || '';
  el.className = 'auth-portal__feedback'
    + (payload.type === 'error' ? ' auth-portal__feedback--error' : '')
    + (payload.type === 'success' ? ' auth-portal__feedback--success' : '');
}

function showAccessAlert(gate) {
  const box = document.getElementById('accessAlert');
  if (!box || !gate?.entitlement) return;
  const label = gate.entitlement.label || '';
  const expired = label.includes('expir') || gate.entitlement.reason === 'expired';
  if (expired) {
    box.hidden = false;
    box.textContent =
      'Votre essai gratuit ou votre licence a expiré. Renouvelez en activant un nouvel essai (si disponible) ou en achetant une licence.';
  } else if (gate.awaitingWebhook) {
    box.hidden = false;
    box.textContent =
      'Paiement en cours de confirmation. L’accès PRO n’est ouvert qu’après validation du webhook Hub (PAYMENT_CONFIRMED).';
  }
}

document.getElementById('btn-go-promo')?.addEventListener('click', () => {
  globalThis.location.href = ROUTES.promo;
});

const configMod = await import('../supabase-config.js').catch(() => null);
if (configMod?.SUPABASE_URL && configMod?.SUPABASE_ANON_KEY) {
  const gate = await bootMbeukHubGate({
    supabaseUrl: configMod.SUPABASE_URL,
    anonKey: configMod.SUPABASE_ANON_KEY,
    productName: 'MbeukImmig Pro',
    sector: 'education',
    authMode: 'existing',
    pageRouting: true,
    protectedRoot: '#access-root',
    skipLiveHub: true,
    feedback,
  });

  showAccessAlert(gate);

  gate.addEventListener('statechange', (event) => {
    const { status } = event.detail || {};
    if ([GateStatus.TRIAL, GateStatus.STANDARD].includes(status)) {
      globalThis.location.replace(ROUTES.app);
    }
  });
}
