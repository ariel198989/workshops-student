'use client';
// The whole tablet sign-in: edge function → supabase password sign-in → auth store → whoami + context.
// The password lives only inside this call.
import { initAuth } from '../auth';
import { sb } from '../db';
import { DeviceLoginError, requestDeviceLogin, type DeviceLoginInput, type DeviceLoginOk } from './device-login';
import { refreshAfterJoin } from './join';

export type DeviceLoginResult = Pick<DeviceLoginOk, 'workshop' | 'group'>;

/** Signs the group device in. Throws DeviceLoginError with Hebrew text. */
export async function deviceLogin(input: DeviceLoginInput): Promise<DeviceLoginResult> {
  const { email, password, workshop, group } = await requestDeviceLogin(input);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new DeviceLoginError('הכניסה לא הצליחה. בקשו מהמדריך לבדוק את הקבוצה ונסו שוב');
  await initAuth();
  await refreshAfterJoin(); // the participant row already exists server-side; whoami and the context just need a refresh
  return { workshop, group };
}
