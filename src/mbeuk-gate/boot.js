/**
 * Point d’entrée unique pour un second SaaS (Vite, PWA, Next client, vanilla).
 * Copier ce dossier dans src/mbeuk-gate/ puis importer ce fichier au bootstrap.
 */
import { MbeukHubGate } from "./mbeuk-hub-gate.js";
import { ensureMbeukPwa } from "./pwa.js";
import { runKitHealthCheck } from "./health-check.js";
/** Styles : lier mbeuk-hub-gate.css dans le HTML (modules vanilla sans bundler). */

export async function bootMbeukHubGate(options = {}) {
  const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
  const functionsUrl = options.functionsUrl
    || `${options.supabaseUrl || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ""}/functions/v1`;
  const anonKey = options.anonKey || env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const gate = new MbeukHubGate({
    functionsUrl,
    anonKey,
    protectedRoot: options.protectedRoot || "#app",
    headerTarget: options.headerTarget || "#hub-user-status",
    productName: options.productName || document.title || "Application SaaS",
    productDescription: options.productDescription || "",
    sector: options.sector || "generic",
    authMode: options.authMode || "existing",
    hideRenewLicense: options.hideRenewLicense !== false,
    pageRouting: options.pageRouting === true,
  });
  await gate.boot();
  if (options.authMode !== "universal") {
    gate.bindExistingAuth({
      loginForm: document.querySelector(options.loginForm || "#login-form, form[data-mbeuk-login]"),
      registerForm: document.querySelector(options.registerForm || "#register-form, form[data-mbeuk-register]"),
      forgotForm: document.querySelector(options.forgotForm || "#forgot-form, form[data-mbeuk-forgot]"),
      promoInput: document.querySelector(options.promoInput || "#promo-code, input[name='promo_code']"),
      buyButton: document.querySelector(options.buyButton || "[data-mbeuk-checkout]"),
      trialButton: document.querySelector(options.trialButton || "[data-mbeuk-trial]"),
      logoutButton: document.querySelector(options.logoutButton || "[data-mbeuk-logout]"),
      feedback: options.feedback,
    });
  }
  await ensureMbeukPwa();
  try {
    await runKitHealthCheck({
      functionsUrl,
      anonKey,
      gateLoaded: true,
      skipLiveHub: options.skipLiveHub === true,
      silent: options.silentHealth === true,
    });
  } catch (healthErr) {
    console.warn("[MbeukHubGate] health check non bloquant", healthErr);
  }
  if (typeof window !== "undefined") window.__mbeukGate = gate;
  return gate;
}

if (typeof window !== "undefined") window.bootMbeukHubGate = bootMbeukHubGate;
