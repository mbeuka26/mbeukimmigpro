#!/usr/bin/env node
/**
 * Installe le SDK officiel inclus dans le kit.
 * Usage: node scripts/install/install-sdk.mjs [path-to-saas-root]
 */
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kitRoot = resolve(__dirname, '../..');
const saasRoot = resolve(process.argv[2] || process.cwd());
const tgz = join(kitRoot, 'sdk/official/mbeuk-hub-sdk-2.0.0.tgz');

if (!existsSync(tgz)) {
  console.error('SDK-001: mbeuk-hub-sdk-2.0.0.tgz introuvable dans le kit.');
  process.exit(1);
}

const pkgPath = join(saasRoot, 'package.json');
if (!existsSync(pkgPath)) {
  console.error('APP-001: package.json introuvable dans', saasRoot);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
const fileRef = `file:${tgz.replace(/\\/g, '/')}`;
pkg.dependencies['mbeuk-hub-sdk'] = fileRef;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const r = spawnSync('npm', ['install'], { cwd: saasRoot, shell: true, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);

console.log('✅ mbeuk-hub-sdk 2.0.0 installé depuis le kit officiel');
console.log('   Source:', tgz);
