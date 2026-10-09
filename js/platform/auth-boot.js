import { bootMbeukHubGate } from '../../src/mbeuk-gate/boot.js';
import { GateStatus } from '../../src/mbeuk-gate/mbeuk-hub-gate.js';
import { ROUTES } from './hub-routes.js';
import { renderImmigrationScene } from './immigration-scene.js';
import '../hub/hub-affiliate.js';

document.getElementById('immigration-scene').innerHTML = renderImmigrationScene();

function feedback(payload) {
  const el = document.getElementById('authMsg');
  if (!el) return;
  el.textContent = payload.text || '';
  el.className = 'auth-portal__feedback'
    + (payload.type === 'error' ? ' auth-portal__feedback--error' : '')
    + (payload.type === 'success' ? ' auth-portal__feedback--success' : '');
}

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const forgotForm = document.getElementById('forgot-form');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const authTabs = document.getElementById('auth-tabs');
const title = document.getElementById('auth-title');
const intro = document.getElementById('auth-intro');

const INTRO_DEFAULT =
  'Guide immigration 20+ pays, CV international et agent IA. Identifiez-vous pour accéder à votre espace métier.';

function setFormValidation(form, enabled) {
  if (!form) return;
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.dataset.wasRequired === '1') {
      if (enabled) el.setAttribute('required', '');
      else el.removeAttribute('required');
    } else if (el.hasAttribute('required')) {
      el.dataset.wasRequired = '1';
      if (!enabled) el.removeAttribute('required');
    }
  });
}

function showPanel(name) {
  for (const form of [loginForm, registerForm, forgotForm]) {
    if (!form) continue;
    const active = form.dataset.authPanel === name;
    form.hidden = !active;
    setFormValidation(form, active);
  }
  const isLogin = name === 'login';
  const isRegister = name === 'register';
  const isForgot = name === 'forgot';
  authTabs.hidden = isForgot;
  intro.hidden = isForgot;
  tabLogin?.setAttribute('aria-selected', String(isLogin));
  tabRegister?.setAttribute('aria-selected', String(isRegister));
  if (title) {
    title.textContent = isForgot
      ? 'Mot de passe perdu'
      : isRegister
        ? 'Créer un compte'
        : 'Connexion';
  }
  if (intro && !isForgot) intro.textContent = INTRO_DEFAULT;
  feedback({ text: '' });
}

tabLogin?.addEventListener('click', () => showPanel('login'));
tabRegister?.addEventListener('click', () => showPanel('register'));
document.getElementById('btn-forgot')?.addEventListener('click', () => showPanel('forgot'));
document.getElementById('btn-back-login')?.addEventListener('click', () => showPanel('login'));

showPanel('login');

async function loadConfig() {
  try {
    return await import('../supabase-config.js');
  } catch {
    feedback({
      type: 'error',
      text: 'Configuration Supabase manquante (js/supabase-config.js).',
    });
    return null;
  }
}

function redirectAfterRegister(gate) {
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

const configMod = await loadConfig();
if (configMod?.SUPABASE_URL && configMod?.SUPABASE_ANON_KEY) {
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

  if (registerForm) {
    registerForm.addEventListener('submit', () => {
      registerForm.dataset.submitting = '1';
    }, { capture: true });
  }

  gate.addEventListener('statechange', (event) => {
    const { status } = event.detail || {};
    if (registerForm?.dataset.submitting === '1' && status !== GateStatus.CHECKING) {
      delete registerForm.dataset.submitting;
      if (redirectAfterRegister(gate)) return;
    }
    if ([GateStatus.TRIAL, GateStatus.STANDARD].includes(status)) {
      globalThis.location.replace(ROUTES.app);
    }
  });

  loginForm?.addEventListener('submit', () => {
    loginForm.dataset.submitting = '1';
  }, { capture: true });

  gate.addEventListener('statechange', (event) => {
    if (loginForm?.dataset.submitting !== '1') return;
    const { status } = event.detail || {};
    if (status === GateStatus.CHECKING) return;
    delete loginForm.dataset.submitting;
    if (status === GateStatus.BLOCKED && gate.client.session) {
      globalThis.location.replace(ROUTES.chooseAccess);
    }
  });
}
