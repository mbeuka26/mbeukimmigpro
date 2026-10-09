/**
 * HubAffiliate — capture ?ref= (kit Mbeuk SaaS)
 */
const AFFILIATE_STORAGE_KEY = 'mbeuk_hub_affiliate_ref';

export const HubAffiliate = {
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
    return typeof window !== 'undefined' ? sessionStorage.getItem(AFFILIATE_STORAGE_KEY) : null;
  },
  setManualCode(code) {
    if (typeof window === 'undefined') return;
    if (code) sessionStorage.setItem('mbeuk_hub_manual_promo', code.trim());
    else sessionStorage.removeItem('mbeuk_hub_manual_promo');
  },
  getManualCode() {
    return typeof window !== 'undefined' ? sessionStorage.getItem('mbeuk_hub_manual_promo') : null;
  },
  getCheckoutPayload() {
    return {
      promo_code: this.getManualCode() || undefined,
      link_ref: this.getLinkRef() || undefined,
    };
  },
};

if (typeof window !== 'undefined') {
  HubAffiliate.captureFromUrl();
  window.HubAffiliate = HubAffiliate;
}
