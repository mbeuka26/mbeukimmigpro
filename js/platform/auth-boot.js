import { initAuthUi } from './auth-ui.js';
import { renderImmigrationScene } from './immigration-scene.js';

initAuthUi();

const sceneEl = document.getElementById('immigration-scene');
if (sceneEl) sceneEl.innerHTML = renderImmigrationScene();

function feedback(payload) {
  const el = document.getElementById('authMsg');
  if (!el) return;
  el.textContent = payload.text || '';
  el.className = 'auth-portal__feedback'
    + (payload.type === 'error' ? ' auth-portal__feedback--error' : '')
    + (payload.type === 'success' ? ' auth-portal__feedback--success' : '');
}

async function bootHub() {
  const { bootMbeukHubGate } = await import('../../src/mbeuk-gate/boot.js');
  const { GateStatus } = await import('../../src/mbeuk-gate/mbeuk-hub-gate.js');
  const { ROUTES } = await import('./hub-routes.js');
  await import('../hub/hub-affiliate.js');

  let configMod;
  try {
    configMod = await import('../supabase-config.js');
  } catch {
    feedback({
      type: 'error',
      text: 'Configuration Supabase manquante (js/supabase-config.js).',
    });
    return;
  }

  if (!configMod?.SUPABASE_URL || !configMod?.SUPABASE_ANON_KEY) return;

  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');

  const gate = await bootMbeukHubGate({
    supabaseUrl: configMod.SUPABASE_URL,
    anonKey: configMod.SUPABASE_ANON_KEY,
    productName: 'MbeukImmig Pro',
    productDescription: 'Immigration, CV et agent IA — accès géré par le Hub Mbeuk.',
    sector: 'education',
    authMode: 'existing',
    pageRouting: true,
    protectedRoot: '#auth-root',
    skipLiveHub: false,
    feedback,
  });

  function redirectAfterRegister() {
    if ([GateStatus.TRIAL, GateStatus.STANDARD].includes(gate.status)) {
      globalThis.location.replace(ROUTES.app);
      return true;
    }
    if (gate.status === GateStatus.BLOCKED && gate.client.session) {
      globalThis.location.replace(ROUTES.chooseAccess);
      return true;
    }
    return false;
  }

  registerForm?.addEventListener('submit', () => {
    registerForm.dataset.submitting = '1';
  }, { capture: true });

  loginForm?.addEventListener('submit', () => {
    loginForm.dataset.submitting = '1';
  }, { capture: true });

  gate.addEventListener('statechange', (event) => {
    const { status } = event.detail || {};
    if (registerForm?.dataset.submitting === '1' && status !== GateStatus.CHECKING) {
      delete registerForm.dataset.submitting;
      if (redirectAfterRegister()) return;
    }
    if (loginForm?.dataset.submitting === '1' && status !== GateStatus.CHECKING) {
      delete loginForm.dataset.submitting;
      if (status === GateStatus.BLOCKED && gate.client.session) {
        globalThis.location.replace(ROUTES.chooseAccess);
      }
    }
    if ([GateStatus.TRIAL, GateStatus.STANDARD].includes(status)) {
      globalThis.location.replace(ROUTES.app);
    }
  });
}

bootHub().catch((err) => {
  console.error('[auth-boot]', err);
  feedback({ type: 'error', text: 'Connexion Hub indisponible. Réessayez.' });
});
