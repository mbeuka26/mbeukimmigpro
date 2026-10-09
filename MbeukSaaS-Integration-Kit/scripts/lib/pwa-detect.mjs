/**
 * Détection PWA existante — ne jamais écraser un SW / manifest déjà en place.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST_CANDIDATES = [
  "public/manifest.webmanifest",
  "public/manifest.json",
  "public/site.webmanifest",
  "manifest.webmanifest",
  "manifest.json",
  "src/manifest.webmanifest",
];

const SW_CANDIDATES = [
  "public/mbeuk-sw.js",
  "public/sw.js",
  "public/service-worker.js",
  "sw.js",
  "mbeuk-sw.js",
];

export function readPkg(root) {
  try {
    return JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

export function detectExistingPwa(root) {
  const pkg = readPkg(root);
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const plugin = Boolean(
    deps?.["vite-plugin-pwa"] ||
      deps?.["next-pwa"] ||
      deps?.serwist ||
      deps?.["@serwist/next"] ||
      deps?.workbox ||
      pkg?.scripts?.["pwa"] ||
      false,
  );
  const manifest = MANIFEST_CANDIDATES.find((rel) => existsSync(join(root, rel))) || null;
  const serviceWorker = SW_CANDIDATES.find((rel) => existsSync(join(root, rel))) || null;
  const present = Boolean(plugin || manifest || serviceWorker);
  return { present, plugin, manifest, serviceWorker };
}

export function publicDir(root) {
  if (existsSync(join(root, "public"))) return join(root, "public");
  return root;
}
