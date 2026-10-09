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
const title = document.getElementById('auth-title');

function showPanel(name) {
  for (const form of [loginForm, registerForm, forgotForm]) {
    if (!form) continue;
    form.hidden = form.dataset.authPanel !== name;
  }
  const isLogin = name === 'login';
  const isRegister = name === 'register';
  tabLogin?.setAttribute('aria-selected', String(isLogin));
  tabRegister?.setAttribute('aria-selected', String(isRegister));
  if (title) {
    title.textContent = name === 'forgot' ? 'Mot de passe oublié' : isRegister ? 'Créer un compte' : 'Connexion';
  }
  feedback({ text: '' });
}

tabLogin?.addEventListener('click', () => showPanel('login'));
tabRegister?.addEventListener('click', () => showPanel('register'));
document.getElementById('btn-forgot')?.addEventListener('click', () => showPanel('forgot'));
document.getElementById('btn-back-login')?.addEventListener('click', () => showPanel('login'));

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

const configMod = await loadConfig();
if (!configMod?.SUPABASE_URL || !configMod?.SUPABASE_ANON_KEY) {
  // stop
} else {
  const gate = await bootMbeukHubGate({
    supabaseUrl: configMod.SUPABASE_URL,
    anonKey: configMod.SUPABASE_ANON_KEY,
    productName: 'MbeukImmig Pro',
    productDescription: 'Immigration, CV et agent IA — accès géré par le Hub Mbeuk.',
    sector: 'education',
    authMode: 'existing',
    pageRouting: true,
    protectedRoot: '#auth-root',
    skipLiveHub: true,
    feedback,
  });

  registerForm?.addEventListener('submit', () => {
    registerForm.dataset.pendingRedirect = 'choose';
  });

  gate.addEventListener('statechange', (event) => {
    const { status } = event.detail || {};
    if ([GateStatus.TRIAL, GateStatus.STANDARD].includes(status)) {
      globalThis.location.replace(ROUTES.app);
      return;
    }
    if (status === GateStatus.BLOCKED && registerForm?.dataset.pendingRedirect === 'choose') {
      delete registerForm.dataset.pendingRedirect;
      globalThis.location.replace(ROUTES.chooseAccess);
    }
  });

  loginForm?.addEventListener('submit', () => {
    loginForm.dataset.pendingLogin = '1';
  });

  gate.addEventListener('statechange', (event) => {
    if (loginForm?.dataset.pendingLogin !== '1') return;
    delete loginForm.dataset.pendingLogin;
    const { status } = event.detail || {};
    if (status === GateStatus.BLOCKED) {
      globalThis.location.replace(ROUTES.chooseAccess);
    }
  });
}
