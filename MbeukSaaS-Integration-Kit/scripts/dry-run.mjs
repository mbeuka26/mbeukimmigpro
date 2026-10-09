#!/usr/bin/env node
/**
 * NATIVA Hub Integration — Dry Run (aucune modification du code métier).
 * Usage: node scripts/dry-run.mjs [path-to-saas-root]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { detectExistingPwa } from './lib/pwa-detect.mjs';

const root = resolve(process.argv[2] || process.cwd());

function detect(name, fn) {
  try { return { name, value: fn(), ok: true }; } catch (e) { return { name, value: 'unknown', ok: false, error: e.message }; }
}

const framework = detect('framework', () => {
  if (existsSync(join(root, 'vite.config.js'))) return 'vite';
  if (existsSync(join(root, 'next.config.ts')) || existsSync(join(root, 'next.config.js'))) return 'nextjs';
  return 'unknown';
});

const auth = detect('auth', () => {
  if (existsSync(join(root, 'supabase/edge-functions/hub-auth-login'))) return 'supabase-edge-functions';
  if (existsSync(join(root, 'src/js/central-saas/central-auth-client.js'))) return 'central-saas-bridge';
  return 'unknown';
});

const database = detect('database', () => {
  if (existsSync(join(root, 'supabase'))) return 'supabase-postgresql';
  return 'unknown';
});

const deployment = detect('deployment', () => {
  if (existsSync(join(root, 'vercel.json'))) return 'vercel';
  return 'unknown';
});

const existingIntegration = existsSync(join(root, 'hub.integration.json'));
const sdkInPkg = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    return !!(pkg.dependencies?.['mbeuk-hub-sdk'] || pkg.devDependencies?.['mbeuk-hub-sdk']);
  } catch { return false; }
})();

const planned = [];
if (!existingIntegration) planned.push('Créer hub.integration.json depuis template');
if (!sdkInPkg) planned.push('Installer mbeuk-hub-sdk via scripts/install/install-sdk.mjs');
if (!existsSync(join(root, 'supabase/edge-functions/hub-auth-login'))) {
  planned.push('Copier/adapter Edge Functions depuis templates/supabase/edge-functions/');
}
if (!existsSync(join(root, 'supabase/migrations'))) {
  planned.push('Appliquer migrations templates/supabase/migrations/');
}
const gatePresent = [
  'src/mbeuk-gate/mbeuk-hub-gate.js',
  'src/js/mbeuk-gate/mbeuk-hub-gate.js',
  'public/mbeuk-gate/mbeuk-hub-gate.js',
].some((rel) => existsSync(join(root, rel)));
if (!gatePresent) {
  planned.push('node scripts/install/apply-kit.mjs <saas-root> puis brancher bootMbeukHubGate()');
}
const pwa = detectExistingPwa(root);
if (!pwa.present) {
  planned.push('Configurer PWA installable (manifest + SW + icônes) via scripts/install/install-pwa.mjs');
}

const risks = [];
if (framework.value === 'unknown') risks.push({ code: 'ENV-001', message: 'Framework non détecté — adapter manuel requis' });
if (auth.value === 'unknown') risks.push({ code: 'AUTH-001', message: 'Couche auth Hub non détectée' });

const report = {
  mode: 'DRY_RUN',
  saas_root: root,
  detected: { framework, auth, database, deployment },
  sdk_detected: sdkInPkg,
  existing_integration: existingIntegration,
  required_variables: ['MBEUK_HUB_URL', 'MBEUK_HUB_API_KEY', 'MBEUK_PRODUCT_ID', 'MBEUK_APPLICATION_ID', 'MBEUK_AUTH_BRIDGE_SECRET'],
  required_files: [
    'hub.integration.json',
    'supabase/edge-functions/hub-*',
    'supabase/edge-functions/_shared/hub-service.ts',
    'src/mbeuk-gate/mbeuk-hub-gate.js (ou src/js|public)',
  ],
  potential_conflicts: [],
  potential_risks: risks,
  planned_modifications: planned,
  note: 'Aucun fichier modifié par ce script.',
};

console.log(JSON.stringify(report, null, 2));
