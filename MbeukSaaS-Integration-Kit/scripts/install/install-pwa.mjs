#!/usr/bin/env node
/**
 * Configure une PWA installable UNIQUEMENT si le projet n’en a pas déjà une.
 * N’écrase jamais vite-plugin-pwa / Serwist / sw.js / manifest existants.
 * Usage: node scripts/install/install-pwa.mjs <saas-root>
 */
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectExistingPwa, readPkg } from "../lib/pwa-detect.mjs";
import { writePngIcon } from "../lib/png-icon.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const kitRoot = resolve(__dirname, "../..");
const saasRoot = resolve(process.argv[2] || process.cwd());
const existing = detectExistingPwa(saasRoot);

function saasName() {
  try {
    const hub = JSON.parse(readFileSync(join(saasRoot, "hub.integration.json"), "utf8"));
    if (hub?.saas?.name && !String(hub.saas.name).includes("${")) return hub.saas.name;
  } catch { /* ignore */ }
  const pkg = readPkg(saasRoot);
  return pkg?.name || "Application SaaS";
}

function injectHead(file) {
  if (!existsSync(file)) return false;
  let html = readFileSync(file, "utf8");
  if (!/<\/head>/i.test(html)) return false;
  const snippets = [];
  if (!/rel=["']manifest["']/i.test(html)) {
    snippets.push('  <link rel="manifest" href="/manifest.webmanifest">');
  }
  if (!/apple-touch-icon/i.test(html)) {
    snippets.push('  <link rel="apple-touch-icon" href="/apple-touch-icon.png">');
  }
  if (!/apple-mobile-web-app-capable/i.test(html)) {
    snippets.push('  <meta name="apple-mobile-web-app-capable" content="yes">');
    snippets.push('  <meta name="mobile-web-app-capable" content="yes">');
  }
  if (!/name=["']theme-color["']/i.test(html)) {
    snippets.push('  <meta name="theme-color" content="#075985">');
  }
  if (!snippets.length) return false;
  html = html.replace(/<\/head>/i, `${snippets.join("\n")}\n</head>`);
  writeFileSync(file, html);
  return true;
}

if (existing.present) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    saas_root: saasRoot,
    existing,
    note: "PWA déjà présente — aucune copie (FIX, DON'T REBUILD).",
  }, null, 2));
  process.exit(0);
}

const pub = join(saasRoot, "public");
mkdirSync(join(pub, "icons"), { recursive: true });

const name = saasName();
const short = name.slice(0, 12);
let manifest = readFileSync(join(kitRoot, "templates/frontend/pwa/manifest.webmanifest"), "utf8");
manifest = manifest.replaceAll("${SAAS_NAME}", name).replaceAll("${SAAS_SHORT_NAME}", short);
writeFileSync(join(pub, "manifest.webmanifest"), manifest);

copyFileSync(join(kitRoot, "templates/frontend/pwa/mbeuk-sw.js"), join(pub, "mbeuk-sw.js"));

const png192 = writePngIcon(192);
const png512 = writePngIcon(512);
writeFileSync(join(pub, "icons/mbeuk-icon-192.png"), png192);
writeFileSync(join(pub, "icons/mbeuk-icon-512.png"), png512);
writeFileSync(join(pub, "apple-touch-icon.png"), png192);

const injected = [
  "index.html",
  "src/index.html",
  "public/index.html",
  "app.html",
  "src/app.html",
  "auth.html",
  "src/auth.html",
].filter((rel) => injectHead(join(saasRoot, rel)));

console.log(JSON.stringify({
  ok: true,
  skipped: false,
  saas_root: saasRoot,
  public_dir: pub,
  written: [
    "manifest.webmanifest",
    "mbeuk-sw.js",
    "icons/mbeuk-icon-192.png",
    "icons/mbeuk-icon-512.png",
    "apple-touch-icon.png",
  ],
  html_injected: injected,
  note: "Service Worker enregistré au boot via src/mbeuk-gate/pwa.js",
}, null, 2));
