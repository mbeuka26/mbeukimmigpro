export const NETWORK_ERROR_MESSAGE =
  "Erreur de connexion, vérifiez votre connexion internet";

export const NO_LICENSE_MESSAGE =
  "Ce compte n'a pas de licence, veuillez acheter une licence ou bénéficier de l'essai gratuit";

export const BUY_LICENSE_LABEL = "Acheter une licence";
export const TRIAL_LABEL = "Essai gratuit";

const PAYMENT_ABORT = new Set([
  "cancel",
  "cancelled",
  "canceled",
  "failed",
  "fail",
  "abandoned",
  "error",
]);

export function isNetworkError(error) {
  if (!error) return false;
  if (error.code === "NETWORK_ERROR" || error.code === "HUB_UNREACHABLE") return true;
  const msg = String(error.message || "").toLowerCase();
  if (
    error.name === "TypeError"
    && (msg.includes("fetch") || msg.includes("network") || msg === "")
  ) {
    return true;
  }
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|offline|internet/.test(msg);
}

/** Une URL ?payment=success ne donne JAMAIS l’accès Standard. */
export function accessGrantedFromPaymentReturn() {
  return false;
}

export function isPaymentAbortValue(value) {
  return PAYMENT_ABORT.has(String(value || "").toLowerCase());
}
