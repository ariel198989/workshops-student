// The take-home link printed on the certificate as a QR. Pure.

/** `${origin}/model/${token}`; null when the group has no share token (contexts before migration 0013). */
export function takeHomeUrl(origin: string, token: string | null | undefined): string | null {
  if (!token || !token.trim()) return null;
  return `${origin.replace(/\/+$/, '')}/model/${encodeURIComponent(token.trim())}`;
}

export const TAKE_HOME_QR_CAPTION = 'סרקו: המודל שלנו רץ אצלכם בטלפון';
