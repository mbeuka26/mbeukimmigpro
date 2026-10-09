export const KIT_HEALTH_OK =
  "OK - Le kit et la PWA installable ont été bien connectés et vérifiés sans faille";

function addIssue(issues, id, message) {
  issues.push({ id, message });
}

function renderHealthBanner({ ok, issues }) {
  if (typeof document === "undefined") return;
  const prev = document.getElementById("mbeuk-kit-health");
  if (prev) prev.remove();
  const el = document.createElement("div");
  el.id = "mbeuk-kit-health";
  el.setAttribute("role", "status");
  el.style.cssText = [
    "position:fixed",
    "z-index:2147483000",
    "left:1rem",
    "right:1rem",
    "bottom:1rem",
    "max-width:42rem",
    "margin:0 auto",
    "padding:0.85rem 1rem",
    "border-radius:0.75rem",
    "font:14px/1.45 system-ui,sans-serif",
    "box-shadow:0 10px 30px rgba(0,0,0,.25)",
    ok ? "background:#14532d;color:#bbf7d0" : "background:#7f1d1d;color:#fecaca",
  ].join(";");
  if (ok) {
    el.textContent = KIT_HEALTH_OK;
  } else {
    const title = document.createElement("strong");
    title.textContent = "Éléments manquants ou erreurs de configuration";
    const list = document.createElement("ul");
    list.style.margin = "0.5rem 0 0";
    list.style.paddingLeft = "1.2rem";
    for (const issue of issues) {
      const li = document.createElement("li");
      li.textContent = `${issue.id} — ${issue.message}`;
      list.appendChild(li);
    }
    el.append(title, list);
  }
  document.body.appendChild(el);
  if (ok) {
    setTimeout(() => el.remove(), 8000);
  }
}

export async function runKitHealthCheck(options = {}) {
  const issues = [];
  if (typeof window === "undefined") {
    return { ok: false, message: null, issues: [{ id: "NO_WINDOW", message: "Health check navigateur indisponible" }] };
  }
  if (!window.bootMbeukHubGate && !options.gateLoaded) {
    addIssue(issues, "GATE_MISSING", "Barrière MbeukHubGate non chargée");
  }
  if (!document.querySelector('link[rel="manifest"]')) {
    addIssue(issues, "MANIFEST_MISSING", "manifest PWA manquant (lien rel=manifest)");
  }
  if (!("serviceWorker" in navigator)) {
    addIssue(issues, "SW_UNSUPPORTED", "Service Worker non supporté par ce navigateur");
  } else {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (!regs.length) addIssue(issues, "SW_MISSING", "Aucun Service Worker enregistré");
  }
  const functionsUrl = String(options.functionsUrl || "").replace(/\/$/, "");
  if (!functionsUrl) {
    addIssue(issues, "HUB_URL_MISSING", "URL Edge/Hub manquante (VITE_SUPABASE_URL)");
  } else if (options.skipLiveHub !== true) {
    try {
      const response = await fetch(`${functionsUrl}/hub-diagnostics`, { method: "GET" });
      if (response.status === 404 || response.status >= 500) {
        addIssue(issues, "HUB_UNREACHABLE", `Route Hub injoignable (HTTP ${response.status})`);
      }
    } catch {
      addIssue(issues, "HUB_UNREACHABLE", "Route Hub injoignable");
    }
  }
  const ok = issues.length === 0;
  const payload = { ok, message: ok ? KIT_HEALTH_OK : null, issues };
  if (options.silent !== true) {
    renderHealthBanner(payload);
    if (ok) console.info("[MbeukHubGate]", KIT_HEALTH_OK);
    else {
      console.error("[MbeukHubGate] Health check — éléments manquants :");
      for (const issue of issues) console.error(` - ${issue.id}: ${issue.message}`);
    }
  }
  return payload;
}
