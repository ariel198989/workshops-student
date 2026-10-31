'use client';
// The whole device sign-in: edge function → supabase password sign-in → auth store → whoami + context.
// Three doors into the same sequence: code + group + PIN (the tablet keypad), join_token (the group QR)
// and the spoken 4-digit workshop number (this device's own account). The password lives only inside this call.
import { initAuth } from '../auth';
import { sb } from '../db';
import { DeviceLoginError, requestDeviceLogin, type DeviceLoginInput, type DeviceLoginOk } from './device-login';
import { refreshAfterJoin } from './join';
import { requestJoinTokenLogin, SIGN_IN_FAILED } from './join-token';
import { requestNumberLogin, type NumberLoginWorkshop } from './number-login';

export type DeviceLoginResult = Pick<DeviceLoginOk, 'workshop' | 'group'>;

/** A phone that scans the group QR while signed in as someone else leaves that session first (this device only). */
async function signOutOtherUser(email: string): Promise<void> {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    if ((session.user.email ?? '').toLowerCase() === email.toLowerCase()) return;
    await sb.auth.signOut({ scope: 'local' });
  } catch {
    // no readable session: signInWithPassword replaces whatever is there
  }
}

/** Password sign-in for any device credentials, then the auth store. */
async function signInWithCredentials(email: string, password: string): Promise<void> {
  await signOutOtherUser(email);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new DeviceLoginError(SIGN_IN_FAILED, 'server');
  await initAuth();
}

async function signInAsDevice({ email, password, workshop, group }: DeviceLoginOk): Promise<DeviceLoginResult> {
  await signInWithCredentials(email, password);
  await refreshAfterJoin(); // the participant row already exists server-side; whoami and the context just need a refresh
  return { workshop, group };
}

/**
 * Signs this phone in as its own device account with the spoken workshop number. No participant row yet:
 * the auth gate reloads whoami on its own and the join flow (group → name) takes it from there.
 */
export async function numberLogin(number: string, deviceId: string): Promise<NumberLoginWorkshop> {
  const { email, password, workshop } = await requestNumberLogin(number, deviceId);
  await signInWithCredentials(email, password);
  return workshop;
}

/** Signs the group device in with code + group + PIN. Throws DeviceLoginError with Hebrew text. */
export async function deviceLogin(input: DeviceLoginInput): Promise<DeviceLoginResult> {
  return signInAsDevice(await requestDeviceLogin(input));
}

/** Signs the group device in with the QR token. Throws DeviceLoginError with Hebrew text. */
export async function joinTokenLogin(token: string): Promise<DeviceLoginResult> {
  return signInAsDevice(await requestJoinTokenLogin(token));
}
