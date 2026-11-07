import { describe, expect, it } from 'vitest';
import { authFeedback, expiryNotice, normalizeEntitlement, GateStatus } from '../src/mbeuk-gate/mbeuk-hub-gate.js';

const server_time = '2026-11-07T12:00:00Z';
const days = (n: number) => new Date(Date.parse(server_time) + n * 86400000).toISOString();

describe('normalizeEntitlement', () => {
  it('essai actif : jours calculés sur server_time, pas sur l’horloge locale', () => {
    const e = normalizeEntitlement(
      { valid: true, server_time, subscription: { status: 'trial', trial_ends_at: days(4) } },
      new Date('2030-01-01'),
    );
    expect(e).toMatchObject({ status: GateStatus.TRIAL, daysRemaining: 4, label: 'VERSION GRATUITE — ESSAI' });
    expect(expiryNotice(e)).toBe("Il vous reste 4 jours d'essai gratuit.");
  });
  it('essai expiré -> bloqué trial_expired', () => {
    const e = normalizeEntitlement({ valid: false, server_time, subscription: { status: 'expired', plan: 'trial', trial_ends_at: days(-1) } });
    expect(e).toMatchObject({ status: GateStatus.BLOCKED, kind: 'trial_expired' });
  });
  it('valid=true mais date dépassée selon le serveur -> bloqué', () => {
    const e = normalizeEntitlement({ valid: true, server_time, subscription: { status: 'active', plan: 'pro', expires_at: days(-1) } });
    expect(e.status).toBe(GateStatus.BLOCKED);
  });
  it('licence Pro / Standard, libellés issus du plan Hub', () => {
    expect(normalizeEntitlement({ valid: true, server_time, subscription: { status: 'active', plan: 'Pro', expires_at: days(200) } }).label).toBe('VERSION PRO — LICENCE ACTIVE');
    expect(normalizeEntitlement({ valid: true, server_time, subscription: { status: 'active', plan: 'standard', expires_at: days(200) } }).label).toBe('VERSION STANDARD — LICENCE ACTIVE');
    expect(normalizeEntitlement({ valid: true, server_time, subscription: { status: 'active', plan: 'licensed', expires_at: days(200) } }).label).toBe('LICENCE ACTIVE');
  });
  it('avertissement à 7 jours par défaut, seuil configurable', () => {
    const near = normalizeEntitlement({ valid: true, server_time, subscription: { status: 'active', plan: 'pro', expires_at: days(7) } });
    expect(near.expiringSoon).toBe(true);
    expect(expiryNotice(near)).toContain('Il vous reste 7 jours');
    const far = normalizeEntitlement({ valid: true, server_time, subscription: { status: 'active', plan: 'pro', expires_at: days(30) } });
    expect(far.expiringSoon).toBe(false);
    const cfg = normalizeEntitlement({ valid: true, server_time, expiry_warning_days: 30, subscription: { status: 'active', plan: 'pro', expires_at: days(30) } });
    expect(cfg.expiringSoon).toBe(true);
  });
  it('pending / none / failed ne donnent jamais accès', () => {
    for (const status of ['pending', 'none', 'blocked']) {
      expect(normalizeEntitlement({ valid: false, server_time, subscription: { status } }).status).toBe(GateStatus.BLOCKED);
    }
    expect(normalizeEntitlement({ valid: true, server_time, payment_status: 'failed', subscription: { status: 'active', plan: 'pro', expires_at: days(10) } }).status).toBe(GateStatus.BLOCKED);
  });
  it('aucun droit -> AUCUN ACCÈS ACTIF', () => {
    expect(normalizeEntitlement({ valid: false, server_time }).label).toBe('AUCUN ACCÈS ACTIF');
  });
});

describe('messages utilisateur', () => {
  it('identifiants : message unique sans révéler l’existence du compte', () => {
    const m = 'Email ou mot de passe incorrect. Veuillez vérifier vos informations et réessayer.';
    for (const code of ['ACCOUNT_NOT_FOUND', 'WRONG_PASSWORD', 'INVALID_CREDENTIALS']) {
      expect(authFeedback({ code })).toBe(m);
    }
  });
  it('email déjà utilisé et code promo invalide', () => {
    expect(authFeedback({ code: 'EMAIL_EXISTS' })).toContain('Cette adresse email existe déjà');
    expect(authFeedback({ code: 'INVALID_PROMO' })).toBe('Code invalide. Veuillez vérifier le code de votre influenceur.');
  });
});
