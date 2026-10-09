#!/usr/bin/env node
/**
 * Autodiagnostic post-installation du kit + PWA.
 * Usage: node scripts/health-check.mjs <saas-root> [--live]
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectExistingPwa, publicDir } from "./lib/pwa-detect.mjs";
import { evaluateHealth, KIT_HEALTH_OK } from "./lib/health-evaluate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const saasRoot = resolve(process.argv[2] && !process.argv[2].startsWith("-")
  ? process.argv[2]
  : process.cwd());
const live = process.argv.includes("--live");

function readText(rel) {
  const p = join(saasRoot, rel);
  try {
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  } catch {
    return "";
  }
}

const pwa = detectExistingPwa(saasRoot);
const pub = publicDir(saasRoot);
const gatePresent = [
  "src/mbeuk-gate/mbeuk-hub-gate.js",
  "src/js/mbeuk-gate/mbeuk-hub-gate.js",
  "public/mbeuk-gate/mbeuk-hub-gate.js",
].some((rel) => existsSync(join(saasRoot, rel)));

const edgeLogin = [
  "supabase/functions/hub-auth-login",
  "supabase/edge-functions/hub-auth-login",
].some((rel) => existsSync(join(saasRoot, rel)));

const envBlob = [
  readText(".env.example"),
  readText(".env"),
  readText(".env.local"),
].join("\n");
const hubUrlConfigured = /(?:VITE_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL|MBEUK_HUB_URL)\s*=/.test(envBlob);

const iconsPresent = existsSync(join(pub, "icons/mbeuk-icon-192.png"))
  && existsSync(join(pub, "icons/mbeuk-icon-512.png"));

let hubUnreachable = null;
if (live) {
  const m = envBlob.match(/(?:VITE_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL)=(\S+)/);
  const base = m?.[1]?.replace(/\/$/, "");
  if (!base || base.includes("your-") || base.includes("${")) {
    hubUnreachable = true;
  } else {
    try {
      const r = await fetch(`${base}/functions/v1/hub-diagnostics`, { method: "GET" });
      hubUnreachable = !r.ok && r.status >= 500;
    } catch {
      hubUnreachable = true;
    }
  }
}

const result = evaluateHealth({
  gatePresent,
  pwaViaPlugin: pwa.plugin,
  manifestPresent: Boolean(pwa.manifest),
  swPresent: Boolean(pwa.serviceWorker),
  iconsPresent: pwa.plugin || iconsPresent,
  hubIntegration: existsSync(join(saasRoot, "hub.integration.json")),
  edgeLogin,
  hubUrlConfigured,
  hubUnreachable,
});

const report = {
  saas_root: saasRoot,
  integration_kit_version: "1.8.0",
  pwa,
  ...result,
  success_message: KIT_HEALTH_OK,
};

const outJson = join(pub, "mbeuk-kit-health.json");
try {
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify(report, null, 2));
} catch { /* ignore */ }

if (result.ok) {
  const html = `<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><title>Health kit</title>
<body style="font-family:system-ui;background:#052e16;color:#bbf7d0;padding:2rem">
<p style="font-size:1.25rem">${KIT_HEALTH_OK}</p></body></html>`;
  try { writeFileSync(join(pub, "mbeuk-kit-health.html"), html); } catch { /* ignore */ }
  console.log(KIT_HEALTH_OK);
} else {
  const rows = result.issues.map((i) => `<li><strong>${i.id}</strong> — ${i.message}</li>`).join("");
  const html = `<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><title>Health kit</title>
<body style="font-family:system-ui;background:#450a0a;color:#fecaca;padding:2rem">
<h1>Éléments manquants ou erreurs de configuration</h1>
<ul>${rows}</ul></body></html>`;
  try { writeFileSync(join(pub, "mbeuk-kit-health.html"), html); } catch { /* ignore */ }
  console.error("Health check — éléments manquants :");
  for (const issue of result.issues) console.error(` - ${issue.id}: ${issue.message}`);
}

console.log(JSON.stringify(report, null, 2));
process.exit(result.ok ? 0 : 1);
