import { describe, expect, it } from 'vitest';
import { runEligibilityV1 } from '../shared/eligibility/rules.ts';

describe('eligibility v1', () => {
  it('covers FR and CA', () => {
    const fr = runEligibilityV1({ countryCode: 'FR', pathwayCode: 'travail', input: { age: 30 } });
    expect(fr.countryCode).toBe('FR');
    const ca = runEligibilityV1({ countryCode: 'CA', pathwayCode: 'express_entry', input: { age: 25 } });
    expect(ca.countryCode).toBe('CA');
  });

  it('returns unknown for unsupported country', () => {
    const r = runEligibilityV1({ countryCode: 'DE', pathwayCode: 'x', input: {} });
    expect(r.checks[0].status).toBe('unknown');
  });
});
