/**
 * Helpers auth Hub — repli sans device_identifier pour éviter DEVICE_LIMIT au login.
 */
import type { MbeukHub } from '../vendor/mbeuk-hub-sdk/index.js';

export type HubLoginPayload = {
  email: string;
  password: string;
  product_id: string;
  device_identifier?: string;
};

export type HubLoginResult = Awaited<ReturnType<MbeukHub['auth']['login']>>;

/** Login Hub avec repli sans empreinte appareil (quota device Hub). */
export async function hubLoginWithDeviceFallback(
  hub: MbeukHub,
  input: HubLoginPayload,
): Promise<HubLoginResult> {
  const base = {
    email: input.email,
    password: input.password,
    product_id: input.product_id,
  };

  if (!input.device_identifier) {
    return hub.auth.login(base);
  }

  const withDevice = await hub.auth.login({
    ...base,
    device_identifier: input.device_identifier,
  });

  if (withDevice.access_granted !== false) {
    return withDevice;
  }

  if (withDevice.session_token) {
    console.warn('[hub-login] access_granted=false but session present — identity login allowed');
    return withDevice;
  }

  console.warn('[hub-login] access_granted=false with device, retry without device_identifier');
  const withoutDevice = await hub.auth.login(base);

  if (withoutDevice.session_token) {
    return {
      ...withoutDevice,
      access_granted: withoutDevice.access_granted !== false,
    };
  }

  return withDevice;
}
