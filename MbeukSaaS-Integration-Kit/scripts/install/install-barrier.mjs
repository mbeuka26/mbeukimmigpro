#!/usr/bin/env node
/**
 * Copie la barrière universelle dans le SaaS sans toucher au métier.
 * Usage: node scripts/install/install-barrier.mjs <saas-root> [--force]
 */
import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const kitRoot = resolve(__dirname, "../..");
const saasRoot = resolve(process.argv[2] || process.cwd());
const force = process.argv.includes("--force");
const src = join(kitRoot, "templates/frontend/universal-barrier");
const dest = join(saasRoot, "src/mbeuk-gate");

if (!existsSync(src)) {
  console.error("KIT-001: templates/frontend/universal-barrier introuvable.");
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
for (const name of readdirSync(src)) {
  const from = join(src, name);
  const to = join(dest, name);
  if (existsSync(to) && !force) {
    console.log("skip (existe déjà):", to);
    continue;
  }
  copyFileSync(from, to);
  console.log("copied:", to);
}

console.log("\nEnsuite dans le header SaaS, ajoutez :");
console.log('  <div id="hub-user-status" aria-live="polite"></div>');
console.log("Et au bootstrap :");
console.log('  import { bootMbeukHubGate } from "./mbeuk-gate/boot.js";');
console.log("  await bootMbeukHubGate({ productName: 'Mon SaaS', sector: 'commerce' });");
