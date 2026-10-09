#!/usr/bin/env node
/**
 * NATIVA Hub Integration — diagnostic (dry, no secrets printed).
 * Usage: node scripts/diagnose/diagnose.mjs [path-to-saas-root]
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { detectExistingPwa } from '../lib/pwa-detect.mjs';

const root = resolve(process.argv[2] || process.cwd());
const steps = [];

function step(id, name, status, message, extra = {}) {
  steps.push({ id, name, status, message, ...extra });
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function detectFramework(dir) {
  if (existsSync(join(dir, 'vite.config.js')) || existsSync(join(dir, 'vite.config.ts'))) return 'vite';
  if (existsSync(join(dir, 'next.config.js')) || existsSync(join(dir, 'next.config.mjs')) || existsSync(join(dir, 'next.config.ts'))) return 'nextjs';
  if (existsSync(join(dir, 'angular.json'))) return 'angular';
  if (existsSync(join(dir, 'vue.config.js'))) return 'vue';
  return 'unknown';
}

function detectPackageManager(dir) {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(dir, 'bun.lockb'))) return 'bun';
  if (existsSync(join(dir, 'package-lock.json'))) return 'npm';
  return 'unknown';
}

function scanForSecrets(dir, depth = 0) {
  if (depth > 4) return [];
  const hits = [];
  const secretPatterns = [
    { re: /mbs_[a-zA-Z0-9]{20,}/, code: 'SDK-001' },
    { re: /sk-ant-[a-zA-Z0-9_-]{20,}/, code: 'SEC-001' },
  ];
  let entries = [];
  try { entries = readdirSync(dir); } catch { return hits; }
  for (const name of entries) {
    if (['node_modules', '.git', 'dist', '.next'].includes(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) hits.push(...scanForSecrets(p, depth + 1));
    else if (/\.(js|ts|tsx|jsx|html|json|env|md)$/.test(name) && !name.endsWith('.example')) {
      try {
        const content = readFileSync(p, 'utf8');
        for (const { re, code } of secretPatterns) {
          if (re.test(content)) hits.push({ file: p.replace(root, '.'), code });
        }
        if (/VITE_.*MBEUK_HUB_API/i.test(content) || /NEXT_PUBLIC_.*MBEUK_HUB_API/i.test(content)) {
          hits.push({ file: p.replace(root, '.'), code: 'SEC-002' });
        }
      } catch { /* ignore */ }
    }
  }
  return hits;
}

// --- Run diagnostics ---
const fw = detectFramework(root);
step('framework', 'Framework', fw !== 'unknown' ? 'PASS' : 'WARN', `Détecté : ${fw}`, { code: fw === 'unknown' ? 'ENV-001' : undefined });

const pm = detectPackageManager(root);
step('package_manager', 'Package manager', 'PASS', pm);

const manifestPath = join(root, 'hub.integration.json');
const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null;
step('manifest', 'hub.integration.json', manifest ? 'PASS' : 'WARN', manifest ? 'Présent' : 'Absent — copier depuis integration/hub.integration.template.json', {
  code: manifest ? undefined : 'APP-001',
  next_action: 'Créer hub.integration.json à partir du template du kit.',
});

const pkg = readJson(join(root, 'package.json'));
const hasSdk = pkg?.dependencies?.['mbeuk-hub-sdk'] || pkg?.devDependencies?.['mbeuk-hub-sdk'];
step('sdk', 'SDK mbeuk-hub-sdk', hasSdk ? 'PASS' : 'WARN', hasSdk ? String(pkg.dependencies?.['mbeuk-hub-sdk'] || pkg.devDependencies?.['mbeuk-hub-sdk']) : 'Non listé dans package.json', {
  code: hasSdk ? undefined : 'SDK-001',
  next_action: 'node scripts/install/install-sdk.mjs',
});

const edgeDir = join(root, 'supabase/edge-functions');
const hubFns = manifest?.edgeFunctions
  ? [...(manifest.edgeFunctions.auth || []), ...(manifest.edgeFunctions.commerce || []), ...(manifest.edgeFunctions.profile || []), ...(manifest.edgeFunctions.diagnostics || [])]
  : ['hub-auth-login', 'hub-checkout', 'hub-sync-license', 'hub-diagnostics'];
const missingFns = hubFns.filter((fn) => !existsSync(join(edgeDir, fn)));
step('edge_functions', 'Edge Functions hub-*', missingFns.length === 0 ? 'PASS' : 'FAIL', missingFns.length ? `Manquantes : ${missingFns.join(', ')}` : 'Toutes présentes', {
  code: missingFns.length ? 'DEPLOY-001' : undefined,
});

const migrationsDir = join(root, 'supabase/migrations');
step('migrations', 'Migrations SaaS', existsSync(migrationsDir) ? 'PASS' : 'WARN', existsSync(migrationsDir) ? 'Dossier migrations trouvé' : 'Aucun dossier supabase/migrations', {
  code: existsSync(migrationsDir) ? undefined : 'DB-001',
});

const secretHits = scanForSecrets(join(root, 'src')).concat(scanForSecrets(join(root, 'dist'))).slice(0, 5);
step('security', 'Scan secrets frontend/dist', secretHits.length === 0 ? 'PASS' : 'FAIL', secretHits.length ? `${secretHits.length} motif(s) suspect(s)` : 'Aucun pattern critique', {
  code: secretHits.length ? 'SEC-001' : undefined,
  details: secretHits,
});

const gateOk = [
  join(root, 'src/mbeuk-gate/mbeuk-hub-gate.js'),
  join(root, 'src/js/mbeuk-gate/mbeuk-hub-gate.js'),
  join(root, 'public/mbeuk-gate/mbeuk-hub-gate.js'),
].some((p) => existsSync(p));
step('universal_gate', 'MbeukHubGate', gateOk ? 'PASS' : 'WARN', gateOk ? 'Barrière présente' : 'Absente — node scripts/install/install-barrier.mjs', {
  code: gateOk ? undefined : 'GATE-001',
  next_action: 'Installer templates/frontend/universal-barrier dans src/mbeuk-gate',
});

const pwa = detectExistingPwa(root);
step('pwa', 'PWA installable', pwa.present ? 'PASS' : 'WARN', pwa.present
  ? (pwa.plugin ? 'Plugin PWA détecté' : `manifest=${pwa.manifest || '—'} sw=${pwa.serviceWorker || '—'}`)
  : 'Absente — node scripts/install/install-pwa.mjs', {
  code: pwa.present ? undefined : 'PWA-001',
  next_action: 'Le kit configure manifest + SW + icônes sans écraser une PWA existante',
});

// Env var names (not values)
const requiredVars = manifest?.serverSecrets?.required || ['MBEUK_HUB_URL', 'MBEUK_HUB_API_KEY', 'MBEUK_PRODUCT_ID'];
step('env', 'Variables serveur requises', 'INFO', requiredVars.join(', '), { next_action: 'Configurer dans Supabase secrets / CI — voir integration/env.example' });

const summary = {
  correlation_id: `diag-${Date.now()}`,
  saas_root: root,
  integration_kit_version: '1.8.0',
  sdk_version: '2.0.0',
  steps,
  counts: {
    pass: steps.filter((s) => s.status === 'PASS').length,
    warn: steps.filter((s) => s.status === 'WARN').length,
    fail: steps.filter((s) => s.status === 'FAIL').length,
  },
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.counts.fail > 0 ? 1 : 0);
