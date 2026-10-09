#!/usr/bin/env node
/**
 * NATIVA Hub Integration — validation post-intégration.
 * Usage: node scripts/validate/validate.mjs [path-to-saas-root]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { detectExistingPwa } from '../lib/pwa-detect.mjs';

const root = resolve(process.argv[2] || process.cwd());
const checks = [];

function check(id, ok, message, extra = {}) {
  checks.push({ id, ok, message, ...extra });
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

// CONFIG
const manifest = readJson(join(root, 'hub.integration.json'));
check('CONFIG_MANIFEST', !!manifest, manifest ? 'hub.integration.json valide' : 'hub.integration.json absent');

if (manifest) {
  const pid = manifest.publicConfig?.productIdVar || 'MBEUK_PRODUCT_ID';
  const aid = manifest.publicConfig?.applicationIdVar || 'MBEUK_APPLICATION_ID';
  check('APP_PRODUCT_SEPARATION', pid !== aid, `Variables distinctes : ${pid} ≠ ${aid}`);
  check('IDENTITY_AUTHORITY', manifest.integration?.identityAuthority === 'mbeuk_hub', 'Autorité identité = mbeuk_hub');
}

// SDK
const pkg = readJson(join(root, 'package.json'));
check('SDK_INSTALLED', !!(pkg?.dependencies?.['mbeuk-hub-sdk'] || pkg?.devDependencies?.['mbeuk-hub-sdk']), 'mbeuk-hub-sdk dans package.json');

// FILES
function existsAny(paths) {
  return paths.some((rel) => existsSync(join(root, rel)));
}

const requiredPatterns = [
  ['supabase/edge-functions/_shared/hub-service.ts', 'supabase/functions/_shared/hub-service.ts'],
  ['supabase/edge-functions/hub-auth-login', 'supabase/functions/hub-auth-login'],
  ['supabase/edge-functions/hub-checkout', 'supabase/functions/hub-checkout'],
  ['supabase/edge-functions/hub-sync-license', 'supabase/functions/hub-sync-license'],
  [
    'src/mbeuk-gate/mbeuk-hub-gate.js',
    'src/js/mbeuk-gate/mbeuk-hub-gate.js',
    'public/mbeuk-gate/mbeuk-hub-gate.js',
  ],
];
for (const paths of requiredPatterns) {
  const id = paths[0].replace(/[/.]/g, '_');
  check(`FILE_${id}`, existsAny(paths), paths.join(' | '));
}

// SECURITY — no hub api key in vite env example
const envExample = existsSync(join(root, '.env.example')) ? readFileSync(join(root, '.env.example'), 'utf8') : '';
check('SECURITY_NO_HUB_KEY_IN_PUBLIC', !/VITE_.*MBEUK_HUB_API_KEY/i.test(envExample), 'Pas de MBEUK_HUB_API_KEY en VITE_*');

const pwa = detectExistingPwa(root);
check('PWA_INSTALLABLE', pwa.present, pwa.present
  ? 'PWA détectée (plugin, manifest ou service worker)'
  : 'PWA absente — node scripts/install/install-pwa.mjs');

// TESTS — run if package.json has test script
if (pkg?.scripts?.test) {
  const r = spawnSync('npm', ['test'], { cwd: root, shell: true, stdio: 'pipe' });
  check('NPM_TEST', r.status === 0, r.status === 0 ? 'npm test OK' : `npm test exit ${r.status}`, { not_executed: r.status !== 0 });
} else {
  check('NPM_TEST', true, 'NOT EXECUTED — pas de script test', { not_executed: true });
}

// BUILD
if (pkg?.scripts?.build) {
  const r = spawnSync('npm', ['run', 'build'], { cwd: root, shell: true, stdio: 'pipe' });
  check('NPM_BUILD', r.status === 0, r.status === 0 ? 'npm run build OK' : `build exit ${r.status}`);
} else {
  check('NPM_BUILD', true, 'NOT EXECUTED — pas de script build', { not_executed: true });
}

const report = {
  saas_root: root,
  integration_kit_version: '1.8.0',
  checks,
  passed: checks.filter((c) => c.ok).length,
  failed: checks.filter((c) => !c.ok).length,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.failed > 0 ? 1 : 0);
