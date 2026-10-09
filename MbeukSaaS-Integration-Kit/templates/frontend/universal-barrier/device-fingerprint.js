const DEVICE_KEY = "mbeuk_hub_device_id";

function fallbackId() {
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function getLocalDeviceId(storage = globalThis.localStorage) {
  try {
    const existing = storage?.getItem(DEVICE_KEY);
    if (existing) return existing;
    const generated = globalThis.crypto?.randomUUID?.() || fallbackId();
    storage?.setItem(DEVICE_KEY, generated);
    return generated;
  } catch {
    return globalThis.crypto?.randomUUID?.() || fallbackId();
  }
}

export async function getDeviceFingerprint() {
  const nav = globalThis.navigator;
  const screen = globalThis.screen;
  const stableSignals = [
    nav?.userAgent || "",
    nav?.language || "",
    nav?.platform || "",
    String(nav?.hardwareConcurrency || ""),
    String(nav?.maxTouchPoints || ""),
    `${screen?.width || 0}x${screen?.height || 0}x${screen?.colorDepth || 0}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  ].join("|");

  if (!globalThis.crypto?.subtle) return stableSignals;
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stableSignals),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function getDeviceIdentity() {
  const fingerprint = await getDeviceFingerprint();
  return {
    device_identifier: fingerprint,
    device_id: fingerprint,
    local_device_id: getLocalDeviceId(),
  };
}
