import { describe, expect, it } from 'vitest';
import { decryptApiKey, encryptApiKey, keyHint } from '../shared/crypto/byok.ts';

const MASTER = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 1)));

describe('BYOK crypto', () => {
  it('encrypts and decrypts without exposing full key in hint', async () => {
    const secret = 'sk-test-1234567890abcdef';
    const enc = await encryptApiKey(secret, MASTER);
    expect(enc.hint).toBe(keyHint(secret));
    expect(enc.hint).not.toContain(secret.slice(0, 6));
    const plain = await decryptApiKey(enc.ciphertext, enc.iv, MASTER);
    expect(plain).toBe(secret);
  });

  it('rejects missing master key', async () => {
    await expect(encryptApiKey('x', '')).rejects.toThrow();
  });
});
