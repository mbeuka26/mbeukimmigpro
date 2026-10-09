#!/usr/bin/env node
/**
 * Application minimale du kit (FIX, DON'T REBUILD).
 * Copie uniquement les fichiers manquants. N’écrase jamais une page auth.
 * Usage: node scripts/install/apply-kit.mjs <saas-root>
 */
import { existsSync, mkdirSync, cpSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const kitRoot = resolve(__dirname, "../..");
const saasRoot = resolve(process.argv[2] || process.cwd());
const report = { copied: [], skipped: [], next: [] };

function copyMissing(from, to, label) {
  if (!existsSync(from)) return;
  if (existsSync(to)) {
    report.skipped.push(label);
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  report.copied.push(label);
}

copyMissing(
  join(kitRoot, "integration/hub.integration.template.json"),
  join(saasRoot, "hub.integration.json"),
  "hub.integration.json",
);
copyMissing(
  join(kitRoot, "integration/env.example"),
  join(saasRoot, ".env.example"),
  ".env.example",
);
copyMissing(
  join(kitRoot, "templates/reports/SAAS-HUB-INTEGRATION-REPORT.template.md"),
  join(saasRoot, "SAAS-HUB-INTEGRATION-REPORT.md"),
  "SAAS-HUB-INTEGRATION-REPORT.md",
);

const barrierSrc = join(kitRoot, "templates/frontend/universal-barrier");
const barrierDest = join(saasRoot, "src/mbeuk-gate");
mkdirSync(barrierDest, { recursive: true });
for (const name of readdirSync(barrierSrc)) {
  const dest = join(barrierDest, name);
  if (existsSync(dest)) {
    report.skipped.push(`src/mbeuk-gate/${name}`);
    continue;
  }
  copyFileSync(join(barrierSrc, name), dest);
  report.copied.push(`src/mbeuk-gate/${name}`);
}

const edgeSrc = join(kitRoot, "templates/supabase/edge-functions");
const edgeDestCandidates = [
  join(saasRoot, "supabase/functions"),
  join(saasRoot, "supabase/edge-functions"),
];
const edgeDest = edgeDestCandidates.find((p) => existsSync(p)) || join(saasRoot, "supabase/functions");
if (existsSync(edgeSrc)) {
  mkdirSync(edgeDest, { recursive: true });
  for (const name of readdirSync(edgeSrc)) {
    copyMissing(join(edgeSrc, name), join(edgeDest, name), `edge:${name}`);
  }
}

const migSrc = join(kitRoot, "templates/supabase/migrations");
const migDest = join(saasRoot, "supabase/migrations");
if (existsSync(migSrc)) {
  mkdirSync(migDest, { recursive: true });
  for (const name of readdirSync(migSrc)) {
    copyMissing(join(migSrc, name), join(migDest, name), `migration:${name}`);
  }
}

report.next.push("Remplir hub.integration.json (ownerType, nom SaaS) sans IDs hardcodés");
report.next.push("Configurer les secrets Edge (jamais VITE_/NEXT_PUBLIC_ pour MBEUK_HUB_API_KEY)");
report.next.push("Ajouter <div id=\"hub-user-status\"> dans le header existant");
report.next.push("Appeler bootMbeukHubGate() au bootstrap, bindExistingAuth si pages auth présentes");
report.next.push("Déployer les fonctions hub-* puis node scripts/validate/validate.mjs <saas-root>");

console.log(JSON.stringify({
  mode: "APPLY_MISSING_ONLY",
  saas_root: saasRoot,
  note: "Aucune page auth existante n’a été réécrite.",
  ...report,
}, null, 2));

if (existsSync(join(saasRoot, "package.json"))) {
  const sdk = spawnSync("node", [join(__dirname, "install-sdk.mjs"), saasRoot], {
    cwd: kitRoot,
    shell: true,
    stdio: "inherit",
  });
  if (sdk.status !== 0) process.exit(sdk.status || 1);
} else {
  report.next.push("package.json absent — installer le SDK plus tard via install-sdk.mjs");
}

const pwa = spawnSync("node", [join(__dirname, "install-pwa.mjs"), saasRoot], {
  cwd: kitRoot,
  shell: true,
  stdio: "inherit",
});
if (pwa.status !== 0) process.exit(pwa.status || 1);

const health = spawnSync("node", [join(kitRoot, "scripts/health-check.mjs"), saasRoot], {
  cwd: kitRoot,
  shell: true,
  stdio: "inherit",
});
if (health.status !== 0) {
  console.error("Health check : éléments manquants — voir public/mbeuk-kit-health.html");
}
