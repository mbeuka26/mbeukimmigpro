import { describe, expect, it } from 'vitest';
import { evaluateAccess } from '../shared/entitlement/access.ts';

const now = new Date('2026-11-07T12:00:00Z');
const future = '2026-11-10T12:00:00Z';
const past = '2026-11-01T12:00:00Z';

describe('evaluateAccess (barrière serveur)', () => {
  it('refuse sans abonnement', () => {
    expect(evaluateAccess(null, now)).toMatchObject({ allowed: false, reason: 'NO_SUBSCRIPTION' });
  });
  it('refuse none / pending / blocked (compte seul ≠ licence)', () => {
    for (const status of ['none', 'pending', 'blocked']) {
      expect(evaluateAccess({ status, expires_at: future }, now).allowed).toBe(false);
    }
  });
  it('autorise un essai actif', () => {
    expect(evaluateAccess({ status: 'trial', trial_ends_at: future }, now)).toMatchObject({ allowed: true, kind: 'trial' });
  });
  it('refuse un essai expiré même si status=trial (cache périmé)', () => {
    expect(evaluateAccess({ status: 'trial', trial_ends_at: past }, now)).toMatchObject({ allowed: false, reason: 'EXPIRED' });
  });
  it('autorise une licence active, refuse une licence expirée', () => {
    expect(evaluateAccess({ status: 'active', expires_at: future }, now).allowed).toBe(true);
    expect(evaluateAccess({ status: 'active', expires_at: past }, now).allowed).toBe(false);
  });
  it('fail-closed sans date de fin ou date invalide', () => {
    expect(evaluateAccess({ status: 'active' }, now)).toMatchObject({ allowed: false, reason: 'NO_END_DATE' });
    expect(evaluateAccess({ status: 'active', expires_at: 'n/a' }, now).allowed).toBe(false);
  });
});
