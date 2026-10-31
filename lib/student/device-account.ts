// Device accounts (a phone that signed in with the spoken workshop number) carry a placeholder name
// until the child types one on the name step. These helpers tell the screens when the account's own
// name means nothing and the participant row's name is the one to show. Pure.
export const DEVICE_EMAIL_DOMAIN = '@devices.corewise.local';
export const PLACEHOLDER_NAME = 'תלמיד/ה';

export const isDeviceEmail = (email: string | null | undefined): boolean =>
  typeof email === 'string' && email.trim().toLowerCase().endsWith(DEVICE_EMAIL_DOMAIN);

export const isPlaceholderName = (name: string | null | undefined): boolean =>
  (name ?? '').trim() === PLACEHOLDER_NAME;

/** The account's own name is worth prefilling only when it is a real name on a real account. */
export function prefillName(metaName: unknown, email: string | null | undefined): string {
  if (typeof metaName !== 'string') return '';
  if (isDeviceEmail(email) || isPlaceholderName(metaName)) return '';
  return metaName;
}

/** What to greet or list: the typed name, never the placeholder. */
export function shownName(fullName: string | null | undefined): string {
  const clean = (fullName ?? '').trim();
  return isPlaceholderName(clean) ? '' : clean;
}
