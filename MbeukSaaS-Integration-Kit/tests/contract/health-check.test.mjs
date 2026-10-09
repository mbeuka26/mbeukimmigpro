import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateHealth, KIT_HEALTH_OK } from "../../scripts/lib/health-evaluate.mjs";

const HEALTH_JS = readFileSync(
  new URL("../../templates/frontend/universal-barrier/health-check.js", import.meta.url),
  "utf8",
);

test("succès : message exact demandé", () => {
  const result = evaluateHealth({
    gatePresent: true,
    pwaViaPlugin: false,
    manifestPresent: true,
    swPresent: true,
    iconsPresent: true,
    hubIntegration: true,
    edgeLogin: true,
    hubUrlConfigured: true,
    hubUnreachable: null,
  });
  assert.equal(result.ok, true);
  assert.equal(result.message, KIT_HEALTH_OK);
  assert.equal(
    KIT_HEALTH_OK,
    "OK - Le kit et la PWA installable ont été bien connectés et vérifiés sans faille",
  );
  assert.match(HEALTH_JS, /OK - Le kit et la PWA installable ont été bien connectés et vérifiés sans faille/);
});

test("liste les éléments manquants (manifest, clés, Hub)", () => {
  const result = evaluateHealth({
    gatePresent: false,
    pwaViaPlugin: false,
    manifestPresent: false,
    swPresent: false,
    iconsPresent: false,
    hubIntegration: false,
    edgeLogin: false,
    hubUrlConfigured: false,
    hubUnreachable: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, null);
  const ids = result.issues.map((i) => i.id);
  assert.deepEqual(ids, [
    "GATE_MISSING",
    "HUB_INTEGRATION_MISSING",
    "EDGE_HUB_LOGIN_MISSING",
    "HUB_URL_MISSING",
    "MANIFEST_MISSING",
    "SW_MISSING",
    "ICONS_MISSING",
    "HUB_UNREACHABLE",
  ]);
});

test("un plugin PWA existant ne exige pas les icônes kit", () => {
  const result = evaluateHealth({
    gatePresent: true,
    pwaViaPlugin: true,
    manifestPresent: false,
    swPresent: false,
    iconsPresent: false,
    hubIntegration: true,
    edgeLogin: true,
    hubUrlConfigured: true,
  });
  assert.equal(result.ok, true);
});
