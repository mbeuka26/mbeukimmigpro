/**
 * Snippet — messages UX auth / promo (kit universel 1.4.0).
 * Adapter showMsg / formatAuthError de votre écran auth.
 */

export const MSG_PROMO_INVALID =
  'Code promo invalide. Vérifiez le code et réessayez.';

export const MSG_NETWORK =
  'Erreur de connexion, vérifiez votre connexion internet';

export function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function isNetworkFetchError(e) {
  const msg = String(e?.message || '').toLowerCase();
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed') ||
    msg.includes('fetch failed')
  ) {
    return true;
  }
  return (
    e?.name === 'TypeError' &&
    (msg.includes('fetch') || msg.includes('network') || msg === '')
  );
}

/** Messages login selon codes Edge hub-auth-login / Hub /api/v1/auth/login */
export function loginErrorMessage(e) {
  if (isNetworkFetchError(e)) return MSG_NETWORK;
  if (e?.code === 'ACCOUNT_NOT_FOUND') {
    return 'Vérifiez votre email et mot de passe.';
  }
  if (e?.code === 'WRONG_PASSWORD') {
    return 'Vérifiez votre mot de passe.';
  }
  if (e?.code === 'INVALID_CREDENTIALS' || e?.code === 'UNAUTHORIZED') {
    return 'Identifiant invalide. Vérifiez votre mot de passe.';
  }
  return e?.message || 'Identifiant invalide. Vérifiez votre mot de passe.';
}

/** Succès promo → checkout */
export function promoSuccessMessage(influencerName) {
  const name = influencerName || 'votre influenceur';
  return `Réussi — vous effectuez vos paiements avec le code de « ${name} ». Redirection vers le paiement…`;
}
