export const KIT_HEALTH_OK =
  "OK - Le kit et la PWA installable ont été bien connectés et vérifiés sans faille";

/**
 * @param {object} flags
 * @param {boolean} [flags.gatePresent]
 * @param {boolean} [flags.pwaViaPlugin]
 * @param {boolean} [flags.manifestPresent]
 * @param {boolean} [flags.swPresent]
 * @param {boolean} [flags.iconsPresent]
 * @param {boolean} [flags.hubIntegration]
 * @param {boolean} [flags.edgeLogin]
 * @param {boolean} [flags.hubUrlConfigured]
 * @param {boolean|null} [flags.hubUnreachable] true = échec live, false = OK, null = non testé
 */
export function evaluateHealth(flags = {}) {
  const issues = [];
  if (!flags.gatePresent) {
    issues.push({
      id: "GATE_MISSING",
      message: "Barrière MbeukHubGate absente (src/mbeuk-gate ou équivalent)",
    });
  }
  if (!flags.hubIntegration) {
    issues.push({
      id: "HUB_INTEGRATION_MISSING",
      message: "hub.integration.json manquant",
    });
  }
  if (!flags.edgeLogin) {
    issues.push({
      id: "EDGE_HUB_LOGIN_MISSING",
      message: "Fonction hub-auth-login manquante",
    });
  }
  if (!flags.hubUrlConfigured) {
    issues.push({
      id: "HUB_URL_MISSING",
      message: "Clé URL frontend manquante (VITE_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL)",
    });
  }
  if (!flags.pwaViaPlugin) {
    if (!flags.manifestPresent) {
      issues.push({
        id: "MANIFEST_MISSING",
        message: "Web App Manifest manquant (manifest.webmanifest / manifest.json)",
      });
    }
    if (!flags.swPresent) {
      issues.push({
        id: "SW_MISSING",
        message: "Service Worker manquant (mbeuk-sw.js / sw.js)",
      });
    }
    if (!flags.iconsPresent) {
      issues.push({
        id: "ICONS_MISSING",
        message: "Icônes PWA 192×192 / 512×512 manquantes",
      });
    }
  }
  if (flags.hubUnreachable === true) {
    issues.push({
      id: "HUB_UNREACHABLE",
      message: "Route Hub injoignable (hub-diagnostics / functions/v1)",
    });
  }
  const ok = issues.length === 0;
  return {
    ok,
    message: ok ? KIT_HEALTH_OK : null,
    issues,
  };
}
