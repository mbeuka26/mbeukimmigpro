/** Chiffrement AES-GCM pour clés BYOK (Web Crypto — Deno & Node 20+) */

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function importMasterKey(masterKeyB64: string): Promise<CryptoKey> {
  const raw = b64ToBytes(masterKeyB64);
  if (raw.length !== 32) {
    throw new Error('BYOK_MASTER_KEY must be 32 bytes base64-encoded');
  }
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function keyHint(apiKey: string): string {
  if (apiKey.length < 8) return '****';
  return `…${apiKey.slice(-4)}`;
}

export async function encryptApiKey(plaintext: string, masterKeyB64: string) {
  if (!masterKeyB64) throw new Error('Chiffrement BYOK indisponible: clé maître absente');
  const key = await importMasterKey(masterKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    ciphertext: bytesToB64(new Uint8Array(cipher)),
    iv: bytesToB64(iv),
    hint: keyHint(plaintext),
  };
}

export async function decryptApiKey(ciphertextB64: string, ivB64: string, masterKeyB64: string) {
  const key = await importMasterKey(masterKeyB64);
  const iv = b64ToBytes(ivB64);
  const cipher = b64ToBytes(ciphertextB64);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}
