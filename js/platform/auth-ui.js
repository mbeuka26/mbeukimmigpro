/** UI onglets auth — synchrone, indépendant du Hub (doit toujours fonctionner). */
export function initAuthUi() {
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

  const panels = [loginForm, registerForm, forgotForm].filter(Boolean);

  function setFormValidation(form, enabled) {
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
    panels.forEach((form) => {
      const active = form.dataset.authPanel === name;
      form.classList.toggle('is-active', active);
      form.toggleAttribute('hidden', !active);
      setFormValidation(form, active);
    });

    const isLogin = name === 'login';
    const isRegister = name === 'register';
    const isForgot = name === 'forgot';

    if (authTabs) authTabs.hidden = isForgot;
    if (intro) intro.hidden = isForgot;

    tabLogin?.setAttribute('aria-selected', String(isLogin));
    tabRegister?.setAttribute('aria-selected', String(isRegister));
    tabLogin?.classList.toggle('is-selected', isLogin);
    tabRegister?.classList.toggle('is-selected', isRegister);

    if (title) {
      title.textContent = isForgot
        ? 'Mot de passe perdu'
        : isRegister
          ? 'Créer un compte'
          : 'Connexion';
    }
    if (intro && !isForgot) intro.textContent = INTRO_DEFAULT;

    const msg = document.getElementById('authMsg');
    if (msg) {
      msg.textContent = '';
      msg.className = 'auth-portal__feedback';
    }
  }

  tabLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    showPanel('login');
  });
  tabRegister?.addEventListener('click', (e) => {
    e.preventDefault();
    showPanel('register');
  });
  document.getElementById('btn-forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    showPanel('forgot');
  });
  document.getElementById('btn-back-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    showPanel('login');
  });

  showPanel('login');
  return { showPanel };
}
