/**
 * Enregistrement PWA : injecte le manifest si besoin, n’ajoute pas un 2e SW.
 */
export async function ensureMbeukPwa() {
  if (typeof document === "undefined") {
    return { registered: false, reason: "no_document" };
  }
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/manifest.webmanifest";
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = "/apple-touch-icon.png";
    document.head.appendChild(apple);
  }
  if (!document.querySelector('meta[name="theme-color"]')) {
    const theme = document.createElement("meta");
    theme.name = "theme-color";
    theme.content = "#075985";
    document.head.appendChild(theme);
  }
  if (!("serviceWorker" in navigator)) {
    return { registered: false, reason: "no_sw_support" };
  }
  const existing = await navigator.serviceWorker.getRegistrations();
  if (existing.length > 0) {
    return { registered: true, existing: true, scope: existing[0].scope };
  }
  try {
    const reg = await navigator.serviceWorker.register("/mbeuk-sw.js", { scope: "/" });
    return { registered: true, existing: false, scope: reg.scope };
  } catch (error) {
    return { registered: false, reason: error?.message || "sw_register_failed" };
  }
}
