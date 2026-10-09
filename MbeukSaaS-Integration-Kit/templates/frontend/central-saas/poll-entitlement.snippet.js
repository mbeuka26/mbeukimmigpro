/**
 * Snippet — polling post-paiement (à intégrer dans AuthService / équivalent).
 * Règle : la page /success ou le retour Chariow N’EST PAS une preuve de licence.
 * Relancer hub-sync-license / checkAccess jusqu’à entitlement actif.
 */
export async function pollEntitlementAfterPayment(deps, opts = {}) {
  const {
    syncLicense, // () => Promise<{ valid: boolean, message?: string }>
    checkAccess, // (opts?) => Promise<{ allowed: boolean }>
    clearAwaitingPayment, // () => void
  } = deps;

  const attempts = Number(opts.attempts) > 0 ? Number(opts.attempts) : 8;
  const delayMs = Number(opts.delayMs) > 0 ? Number(opts.delayMs) : 2500;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let last = { valid: false, message: 'Paiement en cours de confirmation.' };

  for (let i = 0; i < attempts; i++) {
    try {
      last = await syncLicense();
      if (last?.valid) {
        clearAwaitingPayment?.();
        return last;
      }
    } catch (e) {
      last = { valid: false, message: e?.message || last.message };
    }

    try {
      const access = await checkAccess({ refresh: true });
      if (access?.allowed) {
        clearAwaitingPayment?.();
        return { valid: true, message: 'Accès confirmé.', access };
      }
    } catch (_) { /* ignore */ }

    if (i < attempts - 1) await sleep(delayMs);
  }

  return last;
}
