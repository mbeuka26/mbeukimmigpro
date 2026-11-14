import { afterEach, describe, expect, it, vi } from 'vitest';
import { HubGateClient } from '../src/mbeuk-gate/hub-gate-client.js';

afterEach(() => vi.unstubAllGlobals());

describe('HubGateClient — fetch par défaut', () => {
  it("appelle fetch sans `this` d'instance (sinon « Illegal invocation » dans les navigateurs)", async () => {
    const urls: string[] = [];
    // Comme le fetch du navigateur : refuse tout `this` autre que window/undefined.
    vi.stubGlobal('fetch', function (this: unknown, url: string) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    const client = new HubGateClient({ functionsUrl: 'https://x.test/functions/v1', anonKey: 'k' });
    await expect(client.request('hub-ping', {}, { authenticated: false })).resolves.toMatchObject({ ok: true });
    expect(urls).toEqual(['https://x.test/functions/v1/hub-ping']);
  });

  it('signale une vraie coupure réseau avec un diagnostic', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    const client = new HubGateClient({ functionsUrl: 'https://x.test/functions/v1', anonKey: 'k' });
    await expect(client.request('hub-ping', {}, { authenticated: false })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      diagnostic: expect.stringContaining('hub-ping'),
    });
  });
});
