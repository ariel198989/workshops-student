'use client';
// The whole device sign-in: edge function → supabase password sign-in → auth store → whoami + context.
// Two doors into the same sequence: code + group + PIN (the tablet keypad) and join_token (the group QR).
// The password lives only inside this call.
import { initAuth } from '../auth';
import { sb } from '../db';
import { DeviceLoginError, requestDeviceLogin, type DeviceLoginInput, type DeviceLoginOk } from './device-login';
import { refreshAfterJoin } from './join';
import { requestJoinTokenLogin, SIGN_IN_FAILED } from './join-token';

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

async function signInAsDevice({ email, password, workshop, group }: DeviceLoginOk): Promise<DeviceLoginResult> {
  await signOutOtherUser(email);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new DeviceLoginError(SIGN_IN_FAILED, 'server');
  await initAuth();
  await refreshAfterJoin(); // the participant row already exists server-side; whoami and the context just need a refresh
  return { workshop, group };
}

/** Signs the group device in with code + group + PIN. Throws DeviceLoginError with Hebrew text. */
export async function deviceLogin(input: DeviceLoginInput): Promise<DeviceLoginResult> {
  return signInAsDevice(await requestDeviceLogin(input));
}

/** Signs the group device in with the QR token. Throws DeviceLoginError with Hebrew text. */
export async function joinTokenLogin(token: string): Promise<DeviceLoginResult> {
  return signInAsDevice(await requestJoinTokenLogin(token));
}
