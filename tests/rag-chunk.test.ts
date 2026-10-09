import { describe, expect, it } from 'vitest';
import { chunkText, extractTextFromHtml, fingerprintContent } from '../shared/rag/chunk.ts';

describe('rag chunking', () => {
  it('extracts text from html', () => {
    const t = extractTextFromHtml('<html><body><p>Bonjour</p><script>x</script></body></html>');
    expect(t).toContain('Bonjour');
    expect(t).not.toContain('x');
  });

  it('chunks with overlap', () => {
    const long = 'a'.repeat(2500);
    const parts = chunkText(long, 1000, 100);
    expect(parts.length).toBeGreaterThan(1);
  });

  it('stable fingerprint', () => {
    expect(fingerprintContent('abc')).toBe(fingerprintContent('abc'));
  });
});
