import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectExistingPwa } from "../../scripts/lib/pwa-detect.mjs";
import { writePngIcon } from "../../scripts/lib/png-icon.mjs";
import { readFileSync } from "node:fs";

test("détecte l’absence de PWA", () => {
  const dir = join(tmpdir(), `mbeuk-pwa-none-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  try {
    const result = detectExistingPwa(dir);
    assert.equal(result.present, false);
    assert.equal(result.plugin, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("détecte un manifest existant sans l’écraser", () => {
  const dir = join(tmpdir(), `mbeuk-pwa-man-${Date.now()}`);
  mkdirSync(join(dir, "public"), { recursive: true });
  writeFileSync(join(dir, "public/manifest.webmanifest"), "{}");
  try {
    const result = detectExistingPwa(dir);
    assert.equal(result.present, true);
    assert.match(result.manifest, /manifest\.webmanifest$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("détecte vite-plugin-pwa dans package.json", () => {
  const dir = join(tmpdir(), `mbeuk-pwa-plug-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({
    devDependencies: { "vite-plugin-pwa": "^0.20.0" },
  }));
  try {
    const result = detectExistingPwa(dir);
    assert.equal(result.present, true);
    assert.equal(result.plugin, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("génère un PNG valide 192×192", () => {
  const png = writePngIcon(192);
  assert.equal(png[0], 137);
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  assert.ok(png.length > 80);
});

test("le SW du kit n’autorise pas le cache des routes Hub", () => {
  const sw = readFileSync(new URL("../../templates/frontend/pwa/mbeuk-sw.js", import.meta.url), "utf8");
  assert.match(sw, /NEVER_CACHE/);
  assert.match(sw, /hub-auth/);
  assert.match(sw, /hub-checkout/);
});
