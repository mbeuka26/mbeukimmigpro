import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { callFunction, configureSupabase } from './api.js';
import { t } from './i18n.js';
import { PROVIDER_CONSOLE_URLS } from './providers.js';
import { bootMbeukHubGate } from '../../src/mbeuk-gate/boot.js';
import '../hub/hub-affiliate.js';

let locale = document.documentElement.lang?.startsWith('en') ? 'en' : 'fr';
let supabase = null;

function bindModuleNav() {
  const links = document.querySelectorAll('.app-modules [data-module-link]');
  const sections = {
    immipro: document.getElementById('home'),
    cv: document.getElementById('cv-generator'),
    ia: document.getElementById('assistant-ia'),
  };
  const setActive = (id) => {
    links.forEach((a) => a.classList.toggle('is-active', a.dataset.moduleLink === id));
  };
  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      const key = a.dataset.moduleLink;
      const target = sections[key];
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActive(key);
        history.replaceState(null, '', `#${target.id}`);
      }
    });
  });
  const hash = (location.hash || '#home').slice(1);
  if (hash === 'cv-generator') setActive('cv');
  else if (hash === 'assistant-ia') setActive('ia');
  else setActive('immipro');
}

bindModuleNav();

async function loadConfig() {
  try {
    const mod = await import('../supabase-config.js');
    if (mod.SUPABASE_URL && mod.SUPABASE_ANON_KEY) {
      configureSupabase(mod.SUPABASE_URL, mod.SUPABASE_ANON_KEY);
      supabase = createClient(mod.SUPABASE_URL, mod.SUPABASE_ANON_KEY);
      return mod;
    }
  } catch (_) {}
  console.warn('Supabase non configuré — assistant IA indisponible.');
  return null;
}

function refreshConsoleLink() {
  const p = document.getElementById('aiProvider')?.value;
  const a = document.getElementById('consoleLink');
  if (a && p) a.href = PROVIDER_CONSOLE_URLS[p] || '#';
}

async function refreshAuth() {
  if (!supabase) return;
  await supabase.auth.getSession();
  loadProjects();
}

async function loadProjects() {
  if (!supabase) return;
  const list = document.getElementById('projectList');
  if (!list) return;
  const { data } = await supabase
    .from('immigration_projects')
    .select('id, title, destination_country_code, status')
    .order('created_at', { ascending: false });
  list.innerHTML =
    (data ?? [])
      .map((p) => `<li>${p.title} (${p.destination_country_code}) — ${p.status}</li>`)
      .join('') || '<li>Aucun projet</li>';
}

function bindUi() {
  document.getElementById('btnCreateProject')?.addEventListener('click', async () => {
    if (!supabase) return;
    const { error } = await supabase.from('immigration_projects').insert({
      title: document.getElementById('projTitle')?.value || 'Projet',
      destination_country_code: (document.getElementById('projCountry')?.value || 'CA').toUpperCase(),
      pathway_code: document.getElementById('projPathway')?.value || null,
    });
    if (error) alert(error.message);
    loadProjects();
  });

  document.getElementById('btnSearch')?.addEventListener('click', async () => {
    const out = document.getElementById('searchResults');
    if (!out || !supabase) return;
    out.innerHTML = '';
    try {
      const res = await callFunction(supabase, 'rag-search', {
        query: document.getElementById('searchQuery')?.value,
        countryCode: document.getElementById('searchCountry')?.value || null,
      });
      if (!res.passages?.length) {
        out.innerHTML = `<p class="mbeuk-msg">${t('noResults', locale)}</p>`;
        return;
      }
      out.innerHTML = res.passages
        .map(
          (p) =>
            `<div class="mbeuk-passage"><strong>${p.title || ''}</strong><br>${(p.excerpt || '').slice(0, 280)}…<br><a href="${p.url}" target="_blank" rel="noopener" style="color:var(--gold)">${p.url}</a></div>`,
        )
        .join('');
    } catch (e) {
      out.innerHTML = `<p class="mbeuk-msg error">${e.message}</p>`;
    }
  });

  document.getElementById('aiProvider')?.addEventListener('change', refreshConsoleLink);

  document.getElementById('btnSaveKey')?.addEventListener('click', async () => {
    try {
      await callFunction(supabase, 'byok', {
        action: 'save',
        providerId: document.getElementById('aiProvider').value,
        apiKey: document.getElementById('aiKey').value,
      });
      document.getElementById('aiKey').value = '';
      document.getElementById('brainStatus').textContent =
        'Clé enregistrée (hint uniquement côté serveur).';
    } catch (e) {
      document.getElementById('brainStatus').textContent = e.message;
    }
  });

  document.getElementById('btnTestKey')?.addEventListener('click', async () => {
    try {
      const r = await callFunction(supabase, 'byok', {
        action: 'test',
        providerId: document.getElementById('aiProvider').value,
        modelId: document.getElementById('aiModel').value,
      });
      document.getElementById('brainStatus').textContent = r.message;
    } catch (e) {
      document.getElementById('brainStatus').textContent = e.message;
    }
  });

  document.getElementById('btnRevokeKey')?.addEventListener('click', async () => {
    await callFunction(supabase, 'byok', {
      action: 'delete',
      providerId: document.getElementById('aiProvider').value,
    });
    document.getElementById('brainStatus').textContent = 'Clé révoquée.';
  });

  document.getElementById('btnAsk')?.addEventListener('click', async () => {
    const out = document.getElementById('chatOut');
    try {
      await callFunction(supabase, 'byok', {
        action: 'set_mode',
        mode: document.getElementById('aiMode').value,
        defaultProviderId: document.getElementById('aiProvider').value,
        defaultModelId: document.getElementById('aiModel').value,
      });
      const res = await callFunction(supabase, 'ai-chat', {
        messages: [{ role: 'user', content: document.getElementById('chatInput').value }],
        providerId: document.getElementById('aiProvider').value,
        modelId: document.getElementById('aiModel').value,
      });
      out.textContent = `${res.content}\n\n[${res.billingMode} · ${res.provider}]`;
    } catch (e) {
      out.textContent = `${t('genDisabled', locale)} — ${e.message}`;
    }
  });

  document.getElementById('btnEligibility')?.addEventListener('click', async () => {
    try {
      const res = await callFunction(supabase, 'agent', {
        toolName: 'run_eligibility',
        input: {
          countryCode: document.getElementById('projCountry')?.value || 'CA',
          pathwayCode: document.getElementById('projPathway')?.value || 'express_entry',
          profile: { age: 28, language_level: 'B2' },
        },
      });
      document.getElementById('eligOut').textContent = JSON.stringify(res.result, null, 2);
    } catch (e) {
      document.getElementById('eligOut').textContent = e.message;
    }
  });
}

bindUi();
refreshConsoleLink();

const configMod = await loadConfig();
if (configMod?.SUPABASE_URL && configMod?.SUPABASE_ANON_KEY) {
  const gate = await bootMbeukHubGate({
    supabaseUrl: configMod.SUPABASE_URL,
    anonKey: configMod.SUPABASE_ANON_KEY,
    productName: 'MbeukImmig Pro',
    productDescription:
      'Guide immigration 20+ pays, assistant IA, projets et candidature (CV intégré).',
    sector: 'education',
    authMode: 'existing',
    pageRouting: true,
    skipLiveHub: true,
  });
  document.querySelector('[data-mbeuk-logout]')?.addEventListener('click', async () => {
    await gate.logout();
    globalThis.location.replace('./auth.html');
  });
  supabase.auth.onAuthStateChange(refreshAuth);
  refreshAuth();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
