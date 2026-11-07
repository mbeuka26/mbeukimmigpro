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

function accessReasonFromUrl() {
  try {
    return new URLSearchParams(globalThis.location.search).get('reason') || '';
  } catch {
    return '';
  }
}

function showAccessAlert(gate) {
  const box = document.getElementById('accessAlert');
  if (!box) return;
  const urlReason = accessReasonFromUrl();
  const ent = gate?.entitlement;
  const kind = ent?.kind
    || (urlReason === 'trial_expired' || urlReason === 'license_expired' ? urlReason : '');
  const trialBtn = document.querySelector('[data-mbeuk-trial]');
  const continueBtn = document.getElementById('btn-continue-trial');

  // Situation A — essai actif : information + Acheter / Continuer.
  if (gate?.status === GateStatus.TRIAL && urlReason === 'trial') {
    const n = ent?.daysRemaining ?? 0;
    box.hidden = false;
    box.textContent = `Vous utilisez actuellement la version gratuite. Il vous reste ${n} jour${n > 1 ? 's' : ''} d’essai gratuit. Achetez une licence pour profiter de la version professionnelle.`;
    if (trialBtn) trialBtn.hidden = true;
    if (continueBtn) {
      continueBtn.hidden = false;
      continueBtn.onclick = () => globalThis.location.replace(ROUTES.app);
    }
    return;
  }
  if (continueBtn) continueBtn.hidden = true;

  // Situation B — essai expiré : un seul bouton principal.
  if (kind === 'trial_expired') {
    box.hidden = false;
    box.textContent = 'Votre période d’essai gratuit a expiré. Pour continuer à utiliser cette application, veuillez acheter une licence.';
    if (trialBtn) trialBtn.hidden = true;
    return;
  }
  // Licence expirée.
  if (kind === 'license_expired') {
    box.hidden = false;
    box.textContent = 'Votre licence a expiré. Pour continuer à utiliser cette application, veuillez renouveler ou acheter une nouvelle licence.';
    if (trialBtn) trialBtn.hidden = true;
    return;
  }
  // Situation C — aucun droit actif (l’éligibilité à l’essai est vérifiée par le Hub au clic).
  if (urlReason === 'unpaid' || (gate?.status === GateStatus.BLOCKED && gate?.client?.session)) {
    box.hidden = false;
    box.textContent = 'Ce compte ne possède actuellement aucune licence active. Vous devez acheter une licence ou commencer votre période d’essai gratuit si vous êtes encore éligible.';
    if (gate?.awaitingWebhook) {
      box.textContent = 'Nous vérifions votre paiement. Veuillez patienter ou revenir ultérieurement.';
    }
    return;
  }
  if (gate?.awaitingWebhook) {
    box.hidden = false;
    box.textContent = 'Nous vérifions votre paiement. Veuillez patienter ou revenir ultérieurement.';
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

  document.querySelector('[data-mbeuk-trial]')?.addEventListener('click', () => {
    feedback({ type: 'loading', text: 'Activation de l’essai…' });
  });

  gate.addEventListener('statechange', (event) => {
    const { status } = event.detail || {};
    showAccessAlert(gate);
    const onTrialNotice = accessReasonFromUrl() === 'trial';
    if ([GateStatus.TRIAL, GateStatus.STANDARD].includes(status) && !(onTrialNotice && status === GateStatus.TRIAL)) {
      globalThis.location.replace(ROUTES.app);
    }
  });
}
