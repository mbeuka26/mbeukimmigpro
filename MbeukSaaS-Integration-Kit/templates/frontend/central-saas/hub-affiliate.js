/**
 * HubAffiliate — capture ?ref= côté client, résolution serveur au checkout.
 * Ne fait jamais foi pour la commission ; Hub Central tranche au checkout.
 */
const AFFILIATE_STORAGE_KEY = 'mbeuk_hub_affiliate_ref';

const HubAffiliate = {
  /** Extrait et mémorise ?ref= depuis l'URL courante. */
  captureFromUrl() {
    if (typeof window === 'undefined') return null;
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref) {
        sessionStorage.setItem(AFFILIATE_STORAGE_KEY, ref.trim());
        return ref.trim();
      }
    } catch (_) { /* ignore */ }
    return this.getLinkRef();
  },

  getLinkRef() {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(AFFILIATE_STORAGE_KEY);
  },

  setManualCode(code) {
    if (typeof window === 'undefined') return;
    if (code) sessionStorage.setItem('mbeuk_hub_manual_promo', code.trim());
    else sessionStorage.removeItem('mbeuk_hub_manual_promo');
  },

  getManualCode() {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('mbeuk_hub_manual_promo');
  },

  /** Payload pour hub-checkout (priorité manuel > ref URL côté serveur). */
  getCheckoutPayload() {
    return {
      promo_code: this.getManualCode() || undefined,
      link_ref: this.getLinkRef() || undefined,
    };
  },
};

if (typeof window !== 'undefined') window.HubAffiliate = HubAffiliate;

export { HubAffiliate };
